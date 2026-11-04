# Seguridad SYNAPSE — Controles y límites

- Verificación en origen de `Cf-Access-Jwt-Assertion` mediante JWKS Cloudflare, `iss`, `aud`, firma y correo exacto de `SYNAPSE_ADMIN_EMAILS`. Ninguna sesión confiable sin identidad válida.
- Next.js Proxy bloquea navegación; las API de proyectos, versiones, compilación e IA validan otra vez. `SYNAPSE_LOCAL_DEV` solo funciona en modo desarrollo y localhost.
- Contenedores separados, compilador no privilegiado y sin salida a red, límites de memoria/CPU/PIDs, `-no-shell-escape` y timeout.
- Passwords y API keys solo en `.env` del Dell, permisos 0600 y exclusión mediante `.dockerignore`. No publicarlos en logs ni Git.
- Base de datos privada, volumen dedicado y backups con pg_dump; timer pendiente de activación.
- Cloudflare Access debe incluir email exacto y autenticación segura; permitir solo OTP sin filtro de correo es inseguro.
- **Pendientes:** rate limiting/alerta de costos IA, CSRF y revisión de Origin para acciones sensibles, aislamiento microVM del compilador frente a LaTeX malicioso, almacenamiento de objetos para PDFs grandes, restauración de backup verificada.
- No exponer 3410, 5432 ni 8000 públicamente; no usar la app con usuarios ajenos hasta completar el aislamiento.
