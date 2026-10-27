"""Import the complete release capability surface from a staged runtime."""
from __future__ import annotations

import importlib
import importlib.metadata

MODULES = [
    "numpy",
    "pandas",
    "scipy",
    "sklearn",
    "spacy",
    "zh_core_web_sm",
    "pptx",
    "langdetect",
    "pyoxigraph",
    "rdflib",
    "networkx",
    "openpyxl",
    "docx",
    "PIL",
    "faiss",
    "fastembed",
    "onnxruntime",
    "fastapi",
    "uvicorn",
    "websockets",
    "semantica.context.context_graph",
    "semantica.explorer.session",
    "semantica.semantic_extract",
    "semantica.ingest",
    "semantica.provenance",
    "semantica.pipeline",
    "semantica.reasoning",
    "semantica.export",
    "semantica.vector_store",
    "semantica.kg",
    "semantica.triplet_store",
]

for module in MODULES:
    importlib.import_module(module)

assert importlib.metadata.version("semantica") == "0.7.0"
print(f"runtime capability imports verified: {len(MODULES)}")
