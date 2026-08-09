import { revalidatePath } from "next/cache";
import { ChevronDown, Plus, UploadCloud } from "lucide-react";
import {
  createPolicyRuleFromForm,
  deletePolicyRule,
  getPolicyAdminSnapshot,
  publishPolicyBundle,
  setPolicyRuleStatus,
  updateDraftPolicyRuleFromForm,
  type AccordPolicyRule,
  type PolicyRuleStatus
} from "@/lib/db/accord-store";
import { cn } from "@/lib/utils";
import { PolicyImportPanel } from "./policy-import-panel";
import { getAccordOrganizationContext } from "@/lib/auth/organization";

export const dynamic = "force-dynamic";

export default async function PoliciesPage() {
  const organization = await getAccordOrganizationContext({ autoCreate: true });
  const companySlug = organization.companySlug;
  const snapshot = await getPolicyAdminSnapshot(companySlug);
  const draftRules = snapshot.rules.filter((rule) => rule.status === "draft");
  const activeApprovedRules = snapshot.rules.filter((rule) => rule.status === "approved" && rule.active);
  const pendingPublishRules = activeApprovedRules.filter((rule) => !rule.publishedInLatestBundle);
  const publishedApprovedRules = activeApprovedRules.filter((rule) => rule.publishedInLatestBundle);
  const removalPendingRules = snapshot.rules.filter((rule) => rule.publishedInLatestBundle && rule.status !== "approved");
  const pendingPublishCount = pendingPublishRules.length + removalPendingRules.length;
  const previousVersionRules = snapshot.rules.filter((rule) => rule.status === "approved" && !rule.active);
  const rejectedRules = snapshot.rules.filter((rule) => rule.status === "rejected");
  const archivedRules = snapshot.rules.filter((rule) => rule.status === "archived");

  return (
    <div className="app-geist space-y-6">
      <PolicyHeader companyName={organization.companyName} latestBundleVersion={snapshot.latestBundle?.version} pendingPublishCount={pendingPublishCount} />

      <PolicyCommandPanel
        companySlug={companySlug}
        canMutate={snapshot.canMutate}
        latestBundleVersion={snapshot.latestBundle?.version}
        pendingPublishCount={pendingPublishCount}
        counts={[
          { label: "Draft", value: draftRules.length, detail: "Unapproved rules" },
          { label: "Pending", value: pendingPublishCount, detail: "Need publish" },
          { label: "Published", value: publishedApprovedRules.length, detail: "Active in Guard" },
          { label: "Previous", value: previousVersionRules.length, detail: "Review only" },
          { label: "Bundle rules", value: snapshot.latestBundle?.ruleCount || 0, detail: "Last shipped" }
        ]}
      />

      {pendingPublishCount ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-5 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
          <span className="font-medium">{pendingPublishCount} policy change{pendingPublishCount === 1 ? "" : "s"} pending publish.</span>{" "}
          {pendingPublishRules.length ? `${pendingPublishRules.length} approved rule${pendingPublishRules.length === 1 ? "" : "s"} will be added or updated. ` : ""}
          {removalPendingRules.length ? `${removalPendingRules.length} published rule${removalPendingRules.length === 1 ? "" : "s"} will be removed from Accord Guard. ` : ""}
          Publish the bundle to ship the latest policy set.
        </section>
      ) : null}

      {!snapshot.enabled ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-5 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300">
          Policy tables are not active yet. Run the latest Supabase migration, then refresh this page.
        </section>
      ) : null}

      <section className="grid items-start gap-4 2xl:grid-cols-[minmax(720px,1.25fr)_minmax(360px,0.5fr)]">
        <PolicyRuleForm disabled={!snapshot.canMutate} companySlug={companySlug} />

        <div className="space-y-4">
          <RuleBucket
            title="Pending publish"
                       emptyLabel="No pending policy changes."
            rules={pendingPublishRules}
            actionsEnabled={snapshot.canMutate}
          />
          <BundleHistory bundles={snapshot.bundles} />
        </div>
      </section>

      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <RuleBucket
          title="Published rules"
                   emptyLabel="No rules in the current published bundle yet."
          rules={publishedApprovedRules}
          actionsEnabled={snapshot.canMutate}
        />
        <RuleBucket title="Draft rules" emptyLabel="No draft rules yet." rules={draftRules} editable actionsEnabled={snapshot.canMutate} />
      </section>

      <section className="space-y-3">
        <RuleBucket
          title="Previous versions"
          emptyLabel="No previous versions yet."
          rules={previousVersionRules}
          actionsEnabled={snapshot.canMutate}
          collapsible
        />
        <RuleBucket title="Rejected rules" emptyLabel="No rejected rules yet." rules={rejectedRules} actionsEnabled={snapshot.canMutate} collapsible />
        <RuleBucket
          title="Archived rules"
          emptyLabel="No archived rules yet."
          rules={archivedRules}
          actionsEnabled={snapshot.canMutate}
          collapsible
        />
      </section>
    </div>
  );
}

async function createRuleAction(formData: FormData) {
  "use server";
  await createPolicyRuleFromForm(formData, companySlugFromForm(formData));
  revalidatePath("/policies");
}

async function updateDraftRuleAction(formData: FormData) {
  "use server";
  const ruleId = String(formData.get("ruleId") || "");
  if (ruleId) await updateDraftPolicyRuleFromForm(ruleId, formData);
  revalidatePath("/policies");
}

async function approveRuleAction(formData: FormData) {
  "use server";
  const ruleId = String(formData.get("ruleId") || "");
  if (ruleId) await setPolicyRuleStatus(ruleId, "approved");
  revalidatePath("/policies");
}

async function rejectRuleAction(formData: FormData) {
  "use server";
  const ruleId = String(formData.get("ruleId") || "");
  if (ruleId) await setPolicyRuleStatus(ruleId, "rejected");
  revalidatePath("/policies");
}

async function archiveRuleAction(formData: FormData) {
  "use server";
  const ruleId = String(formData.get("ruleId") || "");
  if (ruleId) await setPolicyRuleStatus(ruleId, "archived");
  revalidatePath("/policies");
}

async function restoreRuleAction(formData: FormData) {
  "use server";
  const ruleId = String(formData.get("ruleId") || "");
  if (ruleId) await setPolicyRuleStatus(ruleId, "draft");
  revalidatePath("/policies");
}

async function deleteRuleAction(formData: FormData) {
  "use server";
  const ruleId = String(formData.get("ruleId") || "");
  if (ruleId) await deletePolicyRule(ruleId);
  revalidatePath("/policies");
}

async function publishBundleAction(formData: FormData) {
  "use server";
  await publishPolicyBundle(companySlugFromForm(formData));
  revalidatePath("/policies");
}

function companySlugFromForm(formData: FormData) {
  return (
    String(formData.get("companySlug") || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "test-company"
  );
}

function PolicyHeader({
  companyName,
  latestBundleVersion,
  pendingPublishCount
}: {
  companyName: string;
  latestBundleVersion?: number;
  pendingPublishCount: number;
}) {
  return (
    <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-accord-faint">{companyName} / Policy authoring</p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-[-0.025em] text-accord-text">Policies</h1>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <HeaderStatus label="Supabase live" tone="success" />
        <HeaderStatus label={latestBundleVersion ? `Bundle v${latestBundleVersion}` : "Not published"} />
        <HeaderStatus label={pendingPublishCount ? `${pendingPublishCount} pending` : "Bundle current"} tone={pendingPublishCount ? "warning" : "success"} />
      </div>
    </header>
  );
}

function HeaderStatus({ label, tone = "default" }: { label: string; tone?: "default" | "success" | "warning" }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-accord-muted">
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          tone === "success" && "bg-emerald-500",
          tone === "warning" && "bg-amber-500",
          tone === "default" && "bg-slate-400"
        )}
      />
      {label}
    </span>
  );
}

function PolicyCommandPanel({
  companySlug,
  canMutate,
  latestBundleVersion,
  pendingPublishCount,
  counts
}: {
  companySlug: string;
  canMutate: boolean;
  latestBundleVersion?: number;
  pendingPublishCount: number;
  counts: Array<{ label: string; value: number; detail: string }>;
}) {
  return (
    <section className="rounded-lg border border-accord-border bg-accord-panel">
      <div className="flex flex-col gap-4 border-b border-accord-border px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-accord-text">
            {latestBundleVersion ? `Current Guard bundle · v${latestBundleVersion}` : "No bundle published"}
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-accord-muted">
            Approved rules ship as a compact bundle for the extension.
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-accord-muted">
            <span className={cn("h-1.5 w-1.5 rounded-full", pendingPublishCount ? "bg-amber-500" : "bg-emerald-500")} />
            {pendingPublishCount ? `${pendingPublishCount} change${pendingPublishCount === 1 ? "" : "s"} waiting` : "Deployed"}
          </span>
          {canMutate ? (
            <form action={publishBundleAction}>
              <input type="hidden" name="companySlug" value={companySlug} />
              <button
                type="submit"
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accord-night px-3 text-[13px] font-medium text-white transition-colors hover:bg-accord-navy dark:bg-accord-primary dark:hover:bg-accord-blue"
              >
                <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" />
                Publish bundle
              </button>
            </form>
          ) : (
            <span className="inline-flex h-8 items-center rounded-md border border-accord-border px-3 text-[13px] font-medium text-accord-muted">
              Bundle active
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 divide-x divide-accord-border sm:grid-cols-5">
        {counts.map((count) => (
          <div key={count.label} className="px-4 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.06em] text-accord-muted">{count.label}</p>
            <p className="mt-1.5 text-xl font-semibold text-accord-text [font-variant-numeric:tabular-nums]">{count.value}</p>
            <p className="mt-0.5 text-[11px] text-accord-muted">{count.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PolicyRuleForm({ disabled, companySlug }: { disabled: boolean; companySlug: string }) {
  if (disabled) return <PolicyAuthoringSetup />;

  return (
    <section className="rounded-lg border border-accord-border bg-accord-panel">
      <div className="flex items-center justify-between gap-4 border-b border-accord-border px-4 py-3">
        <div>
          <h2 className="text-[15px] font-semibold text-accord-text">Create rules</h2>
          <p className="mt-0.5 text-xs text-accord-muted">Import a policy document, or write a rule manually — everything starts as a draft</p>
        </div>
      </div>

      <div className="px-4 py-4">
        <PolicyImportPanel companySlug={companySlug} />
      </div>

      <details className="group border-t border-accord-border px-4 py-3.5">
        <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-md border border-accord-primary/30 bg-accord-panel px-3 text-[13px] font-medium text-accord-primary outline-none transition-colors hover:bg-accord-tint group-open:bg-accord-tint [&::-webkit-details-marker]:hidden">
          <Plus className="h-3.5 w-3.5 transition-transform duration-200 group-open:rotate-45" aria-hidden="true" />
          Write a rule manually
        </summary>

        <form action={createRuleAction} className="mt-4 grid gap-4 border-t border-accord-border/60 pt-4">
          <input type="hidden" name="companySlug" value={companySlug} />
          <PolicyFields />
          <div>
            <button
              type="submit"
              className="inline-flex h-8 items-center rounded-md bg-accord-night px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-accord-navy dark:bg-accord-primary dark:hover:bg-accord-blue"
            >
              Save draft rule
            </button>
          </div>
        </form>
      </details>
    </section>
  );
}

function PolicyAuthoringSetup() {
  return (
    <section className="rounded-lg border border-accord-border bg-accord-panel">
      <div className="border-b border-accord-border px-4 py-3">
        <h2 className="text-sm font-semibold text-accord-text">Enable policy authoring</h2>
        <p className="mt-0.5 text-xs leading-5 text-accord-muted">
          The published v1 bundle is active for Accord Guard, but Supabase REST has not exposed the policy authoring
          tables yet.
        </p>
      </div>

      <div className="px-4 py-4">
        <p className="text-[13px] font-medium text-accord-text">To add or edit rules:</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] leading-5 text-accord-muted">
          <li>Run this in the Supabase SQL Editor.</li>
          <li>Wait a few seconds, then refresh this page.</li>
          <li>Use the form to save a draft, approve it, then publish the bundle.</li>
        </ol>
        <pre className="mt-3 overflow-x-auto rounded-md bg-accord-night p-3 font-mono text-xs leading-5 text-slate-100">
{`grant usage on schema public to anon, authenticated, service_role;
grant all on table public.accord_policy_rules to anon, authenticated, service_role;
grant all on table public.accord_policy_bundles to anon, authenticated, service_role;
notify pgrst, 'reload schema';`}
        </pre>
      </div>
    </section>
  );
}

function PolicyFields({ rule }: { rule?: AccordPolicyRule }) {
  const isEditing = Boolean(rule);

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        <Field label="Rule name" name="name" defaultValue={rule?.name || ""} placeholder="e.g. Block HR data in personal AI" />
        <Field
          label="Rule key"
          name="ruleKey"
          defaultValue={rule?.ruleKey || ""}
          placeholder={isEditing ? "existing_rule_key" : "Auto-generated from rule name"}
        />
        <Field label="Source policy" name="sourcePolicyName" defaultValue={rule?.sourcePolicyName || "External AI Usage Policy"} />
        <Field label="Source section / citation" name="sourceSection" defaultValue={rule?.sourceSection || "4.2 - Client Information"} />
        <Field label="User scope" name="userScope" defaultValue={rule?.userScope || "all"} />
        <Field label="Department scope" name="departmentScope" defaultValue={rule?.departmentScope || "all"} />
        <SelectField
          label="AI provider"
          name="aiProvider"
          defaultValue={rule?.aiProvider || "chatgpt"}
          options={["any", "chatgpt", "openai", "anthropic", "gemini", "internal"]}
        />
        <SelectField
          label="Destination/account type"
          name="destinationType"
          defaultValue={rule?.destinationType || "personal"}
          options={["any", "approved", "enterprise", "personal", "unapproved"]}
        />
        <SelectField label="Action" name="action" defaultValue={rule?.action || "transform"} options={["allow", "transform", "warn", "require_approval", "block"]} />
        <SelectField
          label="Fallback action"
          name="fallbackAction"
          defaultValue={rule?.fallbackAction || "block"}
          options={["allow", "transform", "warn", "require_approval", "block"]}
        />
        <SelectField label="Severity" name="severity" defaultValue={rule?.severity || "high"} options={["low", "medium", "high", "critical"]} />
        <Field label="Effective date" name="effectiveDate" type="date" defaultValue={rule?.effectiveDate || new Date().toISOString().slice(0, 10)} />
      </div>

      <div className="grid gap-3 2xl:grid-cols-[minmax(260px,0.65fr)_minmax(0,1.35fr)]">
        <TextArea
          label="Data categories"
          name="dataCategories"
          defaultValue={
            rule?.dataCategories.join(", ") ||
            "client_identifying_info, personal_data, address, account, veterinary_medical_record, payment_information"
          }
          rows={4}
        />
        <TextArea
          label="Supporting excerpt"
          name="supportingExcerpt"
          defaultValue={
            rule?.supportingExcerpt ||
            "Employees must not submit client names, addresses, account numbers, veterinary medical records, payment information, or other identifying information to personal or unapproved AI services. When identifying information can be removed without preventing the task, it must be removed before submission. If adequate de-identification is not possible, the submission must be blocked or routed for approval."
          }
          rows={4}
        />
      </div>

      <TextArea
        label="Employee-facing explanation"
        name="employeeExplanation"
        defaultValue={
          rule?.employeeExplanation ||
          "Client identifying information cannot be sent to personal AI. Accord will remove identifiers when it can do so safely, otherwise the submission is blocked or routed for approval."
        }
        rows={2}
      />
    </>
  );
}

const inputClass =
  "h-8 rounded-md border border-accord-border bg-accord-panel px-2.5 text-[13px] text-accord-text outline-none transition-colors placeholder:text-accord-faint focus:border-accord-primary";

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  placeholder
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-accord-text">
      {label}
      <input className={inputClass} name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} />
    </label>
  );
}

function SelectField({ label, name, defaultValue, options }: { label: string; name: string; defaultValue: string; options: string[] }) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-accord-text">
      {label}
      <select className={inputClass} name={name} defaultValue={defaultValue}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextArea({ label, name, defaultValue, rows }: { label: string; name: string; defaultValue: string; rows: number }) {
  return (
    <label className="grid gap-1.5 text-xs font-medium text-accord-text">
      {label}
      <textarea
        className="resize-y rounded-md border border-accord-border bg-accord-panel px-2.5 py-2 text-[13px] leading-5 text-accord-text outline-none transition-colors placeholder:text-accord-faint focus:border-accord-primary"
        name={name}
        defaultValue={defaultValue}
        rows={rows}
      />
    </label>
  );
}

function RuleBucket({
  title,
  description,
  rules,
  emptyLabel,
  editable = false,
  actionsEnabled = true,
  collapsible = false
}: {
  title: string;
  description?: string;
  rules: AccordPolicyRule[];
  emptyLabel: string;
  editable?: boolean;
  actionsEnabled?: boolean;
  collapsible?: boolean;
}) {
  const header = (
    <div>
      <h2 className="text-sm font-semibold text-accord-text">{title}</h2>
      {description ? <p className="mt-0.5 text-xs text-accord-muted">{description}</p> : null}
    </div>
  );

  const body = rules.length ? (
    <div className="divide-y divide-accord-border/60">
      {rules.map((rule) => (
        <PolicyRuleRow key={rule.id} rule={rule} editable={editable && actionsEnabled} actionsEnabled={actionsEnabled} />
      ))}
    </div>
  ) : (
    <p className="px-4 py-6 text-[13px] text-accord-muted">{emptyLabel}</p>
  );

  if (collapsible) {
    return (
      <details className="group rounded-lg border border-accord-border bg-accord-panel">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 outline-none transition-colors hover:bg-accord-surface/60 [&::-webkit-details-marker]:hidden">
          {header}
          <span className="flex items-center gap-2">
            <span className="font-mono text-xs text-accord-muted [font-variant-numeric:tabular-nums]">{rules.length}</span>
            <ChevronDown className="h-4 w-4 text-accord-faint transition duration-200 group-open:rotate-180" aria-hidden="true" />
          </span>
        </summary>
        <div className="border-t border-accord-border">{body}</div>
      </details>
    );
  }

  return (
    <section className="rounded-lg border border-accord-border bg-accord-panel">
      <div className="flex items-center justify-between gap-4 border-b border-accord-border px-4 py-3">
        {header}
        <span className="font-mono text-xs text-accord-muted [font-variant-numeric:tabular-nums]">{rules.length}</span>
      </div>
      {body}
    </section>
  );
}

function PolicyRuleRow({ rule, editable, actionsEnabled }: { rule: AccordPolicyRule; editable: boolean; actionsEnabled: boolean }) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 outline-none transition-colors hover:bg-accord-surface/60 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-accord-text">{rule.name}</p>
          <p className="mt-0.5 truncate font-mono text-[11px] text-accord-faint">{rule.ruleKey}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <RuleStatusRow rule={rule} />
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-accord-faint transition duration-200 group-open:rotate-180" aria-hidden="true" />
        </div>
      </summary>

      <div className="border-t border-accord-border/60 bg-accord-surface/40 px-4 py-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(240px,0.38fr)] xl:items-start">
          <div className="space-y-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-accord-faint">Employee explanation</p>
              <p className="mt-1.5 text-[13px] leading-6 text-accord-muted">{rule.employeeExplanation}</p>
            </div>

            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-accord-faint">Supporting excerpt</p>
              <p className="mt-1.5 rounded-md border border-accord-border bg-accord-panel p-3 text-[13px] leading-6 text-accord-muted">
                {rule.supportingExcerpt}
              </p>
            </div>

            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-accord-faint">Data categories</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {rule.dataCategories.map((category) => (
                  <span key={category} className="rounded border border-accord-border bg-accord-panel px-1.5 py-0.5 text-[11px] font-medium text-accord-muted">
                    {category.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <aside className="rounded-md border border-accord-border bg-accord-panel p-3">
            <div className="divide-y divide-accord-border/60">
              <RuleMeta label="Source" value={`${rule.sourcePolicyName} ${rule.sourceSection}`} />
              <RuleMeta label="Provider" value={rule.aiProvider} />
              <RuleMeta label="Destination" value={rule.destinationType} />
              <RuleMeta label="Action" value={rule.action} />
              <RuleMeta label="Fallback" value={rule.fallbackAction} />
              <RuleMeta label="Severity" value={rule.severity} />
              <RuleMeta label="Effective" value={rule.effectiveDate} />
            </div>

            {actionsEnabled &&
            (rule.status === "draft" || rule.status === "approved" || rule.status === "archived") ? (
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-accord-border/60 pt-3">
                {rule.status === "draft" ? (
                  <>
                    <RuleActionButton action={approveRuleAction} ruleId={rule.id} label="Approve" />
                    <RuleActionButton action={rejectRuleAction} ruleId={rule.id} label="Reject" />
                  </>
                ) : null}
                {rule.status === "approved" ? <RuleActionButton action={archiveRuleAction} ruleId={rule.id} label="Archive" /> : null}
                {rule.status === "archived" ? (
                  <>
                    <RuleActionButton action={restoreRuleAction} ruleId={rule.id} label="Restore draft" />
                    <RuleActionButton action={deleteRuleAction} ruleId={rule.id} label="Delete" tone="danger" />
                  </>
                ) : null}
              </div>
            ) : null}
          </aside>
        </div>

        {editable ? (
          <details className="mt-4 rounded-md border border-accord-border bg-accord-panel">
            <summary className="cursor-pointer list-none px-3 py-2 text-[13px] font-medium text-accord-text [&::-webkit-details-marker]:hidden">
              Edit draft
            </summary>
            <form action={updateDraftRuleAction} className="grid gap-3 border-t border-accord-border/60 p-3">
              <input type="hidden" name="ruleId" value={rule.id} />
              <PolicyFields rule={rule} />
              <div>
                <button
                  type="submit"
                  className="inline-flex h-8 items-center rounded-md border border-accord-border bg-accord-panel px-3 text-[13px] font-medium text-accord-text transition-colors hover:border-accord-faint"
                >
                  Save draft changes
                </button>
              </div>
            </form>
          </details>
        ) : null}
      </div>
    </details>
  );
}

function RuleStatusRow({ rule }: { rule: AccordPolicyRule }) {
  return (
    <div className="hidden flex-wrap items-center justify-end gap-1.5 sm:flex">
      <StatusPill status={rule.status} />
      <span className="rounded border border-accord-border px-1.5 py-0.5 font-mono text-[11px] text-accord-muted">v{rule.version}</span>
      {rule.status === "approved" ? (
        <span
          className={cn(
            "rounded border px-1.5 py-0.5 text-[11px] font-medium",
            rule.publishedInLatestBundle && "border-accord-primary/25 bg-accord-tint text-accord-primary",
            rule.active && !rule.publishedInLatestBundle && "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-400",
            !rule.active && "border-accord-border bg-accord-surface text-accord-muted"
          )}
        >
          {rule.publishedInLatestBundle
            ? `bundle v${rule.publishedInBundleVersion}`
            : rule.active
              ? "pending publish"
              : "previous version"}
        </span>
      ) : null}
    </div>
  );
}

function RuleMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 first:pt-0 last:pb-0">
      <span className="text-xs text-accord-faint">{label}</span>
      <span className="text-right text-xs font-medium text-accord-text">{value.replace(/_/g, " ")}</span>
    </div>
  );
}

function RuleActionButton({
  action,
  ruleId,
  label,
  tone = "default"
}: {
  action: (formData: FormData) => Promise<void>;
  ruleId: string;
  label: string;
  tone?: "default" | "danger";
}) {
  return (
    <form action={action}>
      <input type="hidden" name="ruleId" value={ruleId} />
      <button
        type="submit"
        className={cn(
          "inline-flex h-7 items-center whitespace-nowrap rounded-md border bg-accord-panel px-2.5 text-xs font-medium transition-colors",
          tone === "danger"
            ? "border-rose-200 text-rose-700 hover:border-rose-300 hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-500/10"
            : "border-accord-border text-accord-text hover:border-accord-faint hover:bg-accord-surface"
        )}
      >
        {label}
      </button>
    </form>
  );
}

function StatusPill({ status }: { status: PolicyRuleStatus }) {
  return (
    <span
      className={cn(
        "rounded border px-1.5 py-0.5 text-[11px] font-medium",
        status === "approved" && "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-400",
        status === "draft" && "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-400",
        status === "rejected" && "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/25 dark:bg-rose-500/10 dark:text-rose-400",
        status === "archived" && "border-accord-border bg-accord-surface text-accord-muted"
      )}
    >
      {status}
    </span>
  );
}

type PolicyBundle = { id: string; version: number; status: string; checksum: string; ruleCount: number; publishedAt: string };

function BundleHistory({ bundles }: { bundles: PolicyBundle[] }) {
  const recent = bundles.slice(0, 3);
  const older = bundles.slice(3);

  return (
    <section className="rounded-lg border border-accord-border bg-accord-panel">
      <div className="border-b border-accord-border px-4 py-3">
        <h2 className="text-sm font-semibold text-accord-text">Bundle history</h2>
      </div>

      {bundles.length ? (
        <>
          <div className="divide-y divide-accord-border/60">
            {recent.map((bundle) => (
              <BundleRow key={bundle.id} bundle={bundle} />
            ))}
          </div>

          {older.length ? (
            <details className="group border-t border-accord-border/60">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-2.5 text-xs font-medium text-accord-muted outline-none transition-colors hover:bg-accord-surface/60 hover:text-accord-text [&::-webkit-details-marker]:hidden">
                <span className="group-open:hidden">Show {older.length} older bundle{older.length === 1 ? "" : "s"}</span>
                <span className="hidden group-open:inline">Hide older bundles</span>
                <ChevronDown className="h-3.5 w-3.5 text-accord-faint transition duration-200 group-open:rotate-180" aria-hidden="true" />
              </summary>
              <div className="divide-y divide-accord-border/60 border-t border-accord-border/60">
                {older.map((bundle) => (
                  <BundleRow key={bundle.id} bundle={bundle} />
                ))}
              </div>
            </details>
          ) : null}
        </>
      ) : (
        <p className="px-4 py-6 text-[13px] text-accord-muted">Publish approved rules to create the first bundle.</p>
      )}
    </section>
  );
}

function BundleRow({ bundle }: { bundle: PolicyBundle }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-accord-text">
          v{bundle.version} <span className="font-normal text-accord-muted">· {bundle.status}</span>
        </p>
        <p className="mt-0.5 truncate font-mono text-[11px] text-accord-faint">{bundle.checksum.slice(0, 24)}</p>
      </div>
      <p className="shrink-0 font-mono text-xs text-accord-muted [font-variant-numeric:tabular-nums]">
        {bundle.ruleCount} rules
      </p>
    </div>
  );
}
