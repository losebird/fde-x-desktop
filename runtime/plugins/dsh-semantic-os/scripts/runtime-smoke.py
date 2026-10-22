"""Import the complete release capability surface from a staged runtime."""
from __future__ import annotations

import importlib
import importlib.metadata

MODULES = [
    "numpy",
    "pandas",
    "scipy",
    "sklearn",
    "umap",
    "spacy",
    "transformers",
    "torch",
    "sentence_transformers",
    "rdflib",
    "networkx",
    "matplotlib",
    "seaborn",
    "plotly",
    "openpyxl",
    "docx",
    "PIL",
    "librosa",
    "cv2",
    "faiss",
    "fastembed",
    "onnxruntime",
    "falkordb",
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
]

for module in MODULES:
    importlib.import_module(module)

assert importlib.metadata.version("semantica") == "0.6.7"
print(f"runtime capability imports verified: {len(MODULES)}")
