# Modelo de amenazas mínimo

- **Archivos LaTeX no confiables**: ejecución de comandos y lecturas de archivos. Compilador con `-no-shell-escape`, identidad no privilegiada, sistema solo lectura, límites de recursos y sin puerto público. No es una frontera suficiente por sí sola: desplegar microVM/aislamiento reforzado antes de uso público.
- **Exposición de API keys**: nunca incluir secretos en el frontend, logs o repositorio; rotar claves comprometidas, configurar únicamente entornos del servidor.
- **Prompts y contenidos no confiables**: texto de papers o LaTeX es dato, no instrucciones privilegiadas; respuesta IA solo como sugerencia revisable.
- **Control de acceso**: versión MVP no implementa autenticación ni cuota. Ejecutar solo en red controlada; añadir autorización sobre todos los recursos antes de publicación.
- **Persistencia**: IndexedDB depende del navegador/perfil; exportar ZIP con frecuencia; no hay respaldo remoto todavía.
- **ZIP**: límite de cantidad/tamaño en importación; ignorar rutas absolutas o traversal; no ejecutar contenido del ZIP.
- **Privacidad**: PDFs y textos enviados a proveedores IA externos solo tras acción del usuario; crear política/retención y consentimiento cuando corresponda.
- **CSP, HTTPS, anti-CSRF, rate limiting, DoS y auditoría**: requisitos de producción no implementados en la base inicial.
