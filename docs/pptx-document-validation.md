# PPTX support in AI document validation

The scoring document reader now recognizes `.pptx` filenames (including uppercase and URL-encoded extensions, with query strings) and the PowerPoint Open XML MIME type. It extracts text from slides, grouped shapes and table cells, using the presentation's relationship order. Master slides, images, speaker notes and embedded files are not used as slide text.

The existing scoring limits remain: 2,000 extracted characters per named document slot and 6,000 characters overall. No Office installation, new Python dependency, environment setting or database migration is required. Legacy binary `.ppt` files are not supported by this change; convert them to `.pptx` or PDF. Image-only slides have no extractable text and require OCR or human review.

Deploy the updated `backend.zip` or `backend_prod.zip`, then rerun AI evaluation for the affected assets. Existing saved scores are not recalculated by deployment alone. Both ZIPs explicitly include the patched `app/services/document_reader.py`; package verification exercises PPTX extraction inside each exact shipped package.

Validation: nine PPTX/document-reader tests cover slide order, grouped text, tables, extraction limits, image-only/corrupt decks, XML limits, MIME/extension detection, sales-pitch slot integration and the existing text-file path. The full backend suite passes (162 tests).
