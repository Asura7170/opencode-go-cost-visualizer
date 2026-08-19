# Opencode Go Cost Visualizer

Dashboard para comparar el costo por request de modelos de IA, con sliders exponenciales de tokens de entrada/salida/caché y límites de uso mensual.

## Uso

No requiere build ni dependencias. Abre `index.html` directamente en Chrome o sirve la carpeta con cualquier servidor estático:

```sh
python -m http.server
```

## Funciones

- Sliders exponenciales (input K=3.0, caché K=2.0, output K=4.0) con entrada numérica sincronizada.
- Cálculo de requests posibles por ventana: 5 horas, semana y mes, según el límite de cada modelo.
- Comparación de costos por modelo con filtro, columnas opcionales y ordenamiento.
- Pestaña "Update Prices": pega datos tabulares para importar precios; se persisten en `localStorage` (botón "Reset Defaults" restaura la tabla base).
- Selección de tier automática según el contexto total (Qwen ≤/ > 256K, GPT 5.6 Luna ≤/ > 272K).

## Estructura

| Archivo | Contenido |
|---|---|
| `index.html` | Estructura, controles y pestañas |
| `app.js` | Lógica: precios, costos, sliders, render |
| `styles.css` | Estilos (Chrome-first, CSS moderno) |

## Datos de modelos

La tabla base está en `defaultModels` (app.js). Cada modelo tiene: `name`, `input`, `output`, `cacheRead`, `cacheWrite` y `monthlyLimitUsd` (USD/mes). El campo `cacheWrite` es **decorativo** y no participa en ningún cálculo; se conserva solo para mantener el formato de los datos originales.