# Accord internal enforcement rules

`InternalPolicyRule` is the single runtime schema for Accord built-ins and reviewed organization rules. Existing document-import drafts are converted into this schema only when an admin publishes a bundle. Future document compilers should target the same type and remain behind admin review.

The local decision pipeline is:

1. Accord Core produces deterministic detector findings.
2. `retrievePolicyCandidates` finds potentially relevant enabled rules from detector signals, local concepts, keywords, and local lexical example similarity.
3. `evaluatePolicyRule` applies provider/app/user scope, exclusions, and required deterministic detector or concept evidence.
4. `evaluatePolicySet` resolves the matched rules.

Retrieval is never enforcement. A semantic-example score can retrieve a rule, but a rule without deterministic detector or concept evidence is rejected with `no_deterministic_enforcement_evidence` and cannot hold or block a request.

Decision precedence is `BLOCK > HOLD > REDACT > ALLOW`. For equal actions, an explicit reviewed organization rule outranks an Accord built-in, followed by severity and stable rule ID. Accord Core and organization-policy decisions are merged by the extension using the same action order, so a stronger action is never weakened.

Employee prompt text is used only inside the browser evaluation call. Published bundles contain policy examples and citations, not employee content. Telemetry contains rule IDs, source, action, severity, categories, counts, and other bounded metadata; it excludes prompt text and detected values.
