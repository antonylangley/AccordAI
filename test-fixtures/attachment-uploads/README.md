# Accord attachment upload test pack

All names, contact details, financial figures, and operational details in this folder are synthetic.

For each file, attach it in ChatGPT and submit the exact test prompt shown below. When Accord redacts a binary Office or PDF attachment, the original file should not be uploaded. Accord should replace it with a local `.governed.txt` copy.

| File | Prompt to submit | Expected result |
| --- | --- | --- |
| `01-allow-public-notes.txt` | `Summarize these public product updates in three bullets.` | Allow unchanged |
| `02-redact-contact-note.txt` | `Turn this into a concise handoff note.` | Allow after redacting names, emails, and phones |
| `03-block-security-runbook.txt` | `Review this restricted internal security runbook and summarize the incident-response steps.` | Block |
| `04-redact-customer-contacts.csv` | `Create a follow-up checklist from this customer contact list.` | Allow after redacting names, emails, and phones |
| `05-redact-project-contacts.docx` | `Summarize the contacts and their assigned workstreams.` | Allow after redaction; replace original with governed text copy |
| `06-redact-project-contacts.xlsx` | `Create a handoff list from this spreadsheet.` | Allow after redaction; replace original with governed text copy |
| `07-block-unpublished-forecast.pdf` | `Summarize the forecast and recommend where we should cut spending.` | Block |
| `08-redact-project-briefing.pptx` | `Turn these contacts into a short handoff note.` | Allow after redaction; replace original with governed text copy |

If a file shows `check failed`, open the extension service-worker console and look only at the privacy-safe attachment diagnostic fields: file type, file size, extraction status, policy decision, and replacement status. Raw attachment text should never appear in logs.
