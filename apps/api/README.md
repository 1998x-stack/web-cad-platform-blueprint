# apps/api — planned app boundary

Future authenticated REST API covering projects, document revisions, model releases, upload permissions, export jobs and agent grants. Not implemented in this blueprint.

Business logic must call the same CommandService as the browser, with robust resource-scoped authorization and optimistic concurrency. See docs/09 and docs/10.
