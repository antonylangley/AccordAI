# Accord policy embedding model

- Runtime ID: `accord-policy-embedding-v1`
- Upstream model: `Xenova/all-MiniLM-L6-v2`
- Upstream revision: `751bff37182d3f1213fa05d7196b954e230abad9`
- License: Apache-2.0
- Runtime artifact: `onnx/model_quantized.onnx` (q8)
- Output: 384-dimensional, mean-pooled, normalized sentence embedding
- ONNX SHA-256: `afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1`

This model is bundled with the Chrome extension and loaded locally. Remote model
loading is disabled. It is used only to retrieve candidate policy rules; it does
not determine policy enforcement.
