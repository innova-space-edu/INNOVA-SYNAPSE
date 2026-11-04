import re
from pathlib import PurePosixPath

EXTENSIONS = {'.tex','.bib','.sty','.cls','.bst','.png','.jpg','.jpeg','.pdf','.eps','.txt','.keep'}
BINARY = {'.png','.jpg','.jpeg','.pdf','.eps'}
MAX_FILES = 150
MAX_BYTES = 25 * 1024 * 1024

def safe_name(name: str) -> bool:
    if not isinstance(name, str) or len(name) > 260 or not name or '\\' in name or '\x00' in name or name.startswith('/'):
        return False
    if re.match(r'^[A-Za-z]:', name):
        return False
    parts = name.split('/')
    return all(part not in ('', '.', '..') and (not part.startswith('.') or part == '.keep') for part in parts) and PurePosixPath(name).suffix.lower() in EXTENSIONS

def valid_main(name: str, filenames: set[str]) -> bool:
    return safe_name(name) and name.endswith('.tex') and name in filenames
