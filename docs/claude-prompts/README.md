# Claude Prompts

Contexto e instrucciones para Claude AI al trabajar en este proyecto.

---

## Contenido

| Documento | Descripcion |
|-----------|-------------|
| [project-context.md](./project-context.md) | Contexto inicial del proyecto (migracion PyQt5 → Tauri) |
| [development-instructions.md](./development-instructions.md) | Instrucciones de desarrollo Phase 2 |

---

## Archivo Principal

El archivo principal de contexto para Claude es [CLAUDE.md](../../CLAUDE.md) en la raiz del proyecto.

Este archivo contiene:
- Descripcion del proyecto
- Arquitectura contable global
- Stack tecnologico
- Estructura del proyecto
- Comandos utiles
- Convenciones de codigo

---

## Uso

Al iniciar una sesion con Claude Code, el archivo CLAUDE.md se carga automaticamente como contexto del proyecto.

Los documentos en esta carpeta son referencias adicionales para contexto historico o instrucciones especificas.

---

## Notas Importantes para Claude

1. **Contabilidad es GLOBAL** - No depende del selector de colegio
2. Usar `globalAccountingService` para operaciones contables
3. `AccountType` usa valores en minuscula (`asset_fixed`, no `ASSET_FIXED`)
4. Los colegios son fuentes de ingreso, no entidades contables separadas

---

[← Volver al indice](../README.md)
