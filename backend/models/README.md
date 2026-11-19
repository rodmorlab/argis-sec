# Modelos locales

Los archivos GGUF se excluyen de Git. Express inicia Docker Compose cuando `CHAT_AI_ENABLED=true` y `CHAT_AI_URL` queda vacía. Elige el archivo con `CHAT_AI_MODEL_FILE`. El modelo incluido en la prueba anterior fue `Qwen3.5-0.8B-Q8_0.gguf`, de [ggml-org](https://huggingface.co/ggml-org/Qwen3.5-0.8B-GGUF).

Para probar Qwen 3.5 2B con un peso cercano a 2 GB, guarda `qwen3.5-2b-Q8_0.gguf` en esta carpeta. El [archivo publicado](https://huggingface.co/gguf/Qwen3.5-2B-GGUF/blob/main/qwen3.5-2b-Q8_0.gguf) pesa 2.08 GB y su SHA-256 es `4546b2079c413c3a3a5890837ad009f66e3b8bd9e8213ed07de3d15fbd360418`. Selecciónalo en `backend/.env` con `CHAT_AI_MODEL_FILE=qwen3.5-2b-Q8_0.gguf`.

Para usar Vulkan en Linux con `/dev/dri/renderD128`, configura `CHAT_AI_VULKAN=true` y `CHAT_AI_GPU_LAYERS=99`. Si la memoria disponible no alcanza, baja el número de capas o usa el modelo anterior. La memoria total incluye contexto y buffers.
