# Preservación y migración desde Prism

1. En Prism (cuenta propia), exportar **todos los proyectos (ZIP)** desde ajustes de datos; exportar PDF de cada proyecto crítico.
2. Verificar que cada ZIP contenga uno o más .tex, imágenes y bibliografía .bib/.bst/.sty/.cls cuando proceda.
3. Guardar una copia íntegra fuera del navegador, con backups separados y, si es posible, SHA-256 del ZIP.
4. Abrir INNOVA SYNAPSE en el navegador de confianza; pulsar **Importar**, seleccionar ZIP y verificar árbol de fuentes.
5. Compilar contra el contenedor aislado; comparar PDF con el exportado de Prism. Diferencias pueden deberse a paquetes TeX, fuentes y motor.
6. Corregir referencias a recursos externos y dependencias faltantes. No borrar ni modificar la copia original exportada.
7. Exportar el proyecto desde SYNAPSE en ZIP y guardar un respaldo.
8. Repetir con cada proyecto; registrar resultados.

## Exclusiones actuales
- No importa automáticamente los hilos de conversaciones JSON, comentarios, miembros compartidos, historial de versiones ni permisos de Prism.
- No existe mecanismo autorizado para recuperar el backend ni el código fuente privado de OpenAI.
- Proyecto guardado en IndexedDB del navegador en esta versión: no es sincronización entre equipos. Exportar con frecuencia.
- Antes de 2027, realizar las exportaciones oficiales y revisar la integridad de los ZIP.
