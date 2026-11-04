import base64
import hmac
import os
import subprocess
import tempfile
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

from validate import BINARY, MAX_FILES, MAX_BYTES, safe_name, valid_main

app = FastAPI(title='INNOVA SYNAPSE isolated LaTeX compiler', docs_url=None, redoc_url=None, openapi_url=None)

class SourceFile(BaseModel):
    path: str
    content: str
    encoding: str = 'utf8'

class CompileRequest(BaseModel):
    mainFile: str
    files: list[SourceFile] = Field(max_length=MAX_FILES)

@app.get('/health')
def health():
    return {'ok': True}

@app.post('/compile')
def compile_project(body: CompileRequest, authorization: str = Header(default='')):
    token = os.environ.get('COMPILER_TOKEN', '')
    if not token or not hmac.compare_digest(authorization, 'Bearer ' + token):
        raise HTTPException(status_code=401, detail='Unauthorized')
    names = {file.path for file in body.files}
    if not valid_main(body.mainFile, names):
        raise HTTPException(status_code=400, detail='Invalid main file')
    if len(names) != len(body.files) or any(not safe_name(f.path) for f in body.files):
        raise HTTPException(status_code=400, detail='Invalid file manifest')

    total = 0
    with tempfile.TemporaryDirectory(prefix='synapse-', dir='/tmp') as dirname:
        workdir = Path(dirname)
        for source in body.files:
            if source.encoding not in ('base64', 'utf8'):
                raise HTTPException(status_code=400, detail='Invalid encoding')
            if source.encoding == 'base64' and Path(source.path).suffix.lower() not in BINARY:
                raise HTTPException(status_code=400, detail='Invalid binary extension')
            try:
                data = base64.b64decode(source.content, validate=True) if source.encoding == 'base64' else source.content.encode('utf-8')
            except (ValueError, UnicodeError) as exc:
                raise HTTPException(status_code=400, detail='Invalid file content') from exc
            if len(data) > 5 * 1024 * 1024:
                raise HTTPException(status_code=413, detail='Individual file too large')
            total += len(data)
            if total > MAX_BYTES:
                raise HTTPException(status_code=413, detail='Project too large')
            target = workdir / source.path
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        main = body.mainFile
        try:
            process = subprocess.run(
                ['latexmk', '-pdf', '-no-shell-escape', '-interaction=nonstopmode',
                 '-halt-on-error', '-file-line-error', '-synctex=0', main],
                cwd=dirname, capture_output=True, text=True, errors='replace',
                timeout=45, env={ 'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': '/tmp',
                                  'TEXMFOUTPUT': dirname, 'openin_any': 'p', 'openout_any': 'p' }
            )
            log = (process.stdout + '\n' + process.stderr)[-18000:]
        except subprocess.TimeoutExpired:
            return {'ok': False, 'error': 'Tiempo de compilación agotado (45 s)', 'log': ''}
        pdf = (workdir / main).with_suffix('.pdf')
        if process.returncode != 0 or not pdf.is_file():
            return {'ok': False, 'error': 'La compilación devolvió errores', 'log': log}
        content = pdf.read_bytes()
        if len(content) > 15 * 1024 * 1024:
            return {'ok': False, 'error': 'PDF demasiado grande', 'log': log}
        return {'ok': True, 'pdf': base64.b64encode(content).decode(), 'log': log}
