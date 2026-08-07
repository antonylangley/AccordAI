import { revalidatePath } from "next/cache";
import { Archive, BadgeCheck, ChevronDown, Clock3, FileText, PencilLine, Plus, RotateCcw, Trash2, UploadCloud } from "lucide-react";
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
    <div className="app-geist space-y-7">
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
        <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-800 shadow-sm">
          <span className="font-semibold">{pendingPublishCount} policy change{pendingPublishCount === 1 ? "" : "s"} pending publish.</span>{" "}
          {pendingPublishRules.length ? `${pendingPublishRules.length} approved rule${pendingPublishRules.length === 1 ? "" : "s"} will be added or updated. ` : ""}
          {removalPendingRules.length ? `${removalPendingRules.length} published rule${removalPendingRules.length === 1 ? "" : "s"} will be removed from Accord Guard. ` : ""}
          Publish the bundle to ship the latest policy set.
        </section>
      ) : null}

      {!snapshot.enabled ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800 shadow-sm">
          Policy tables are not active yet. Run the latest Supabase migration, then refresh this page.
        </section>
      ) : null}

      <section className="grid items-start gap-6 2xl:grid-cols-[minmax(760px,1.25fr)_minmax(390px,0.5fr)]">
        <PolicyRuleForm disabled={!snapshot.canMutate} companySlug={companySlug} />

        <div className="space-y-6">
          <RuleBucket
            title="Pending publish"
            description="Approved rules waiting for the next published bundle."
            emptyLabel="No pending policy changes."
            rules={pendingPublishRules}
            actionsEnabled={snapshot.canMutate}
          />
          <BundleHistory bundles={snapshot.bundles} />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <RuleBucket
          title="Published rules"
          description="Active controls included in the current Accord Guard bundle."
          emptyLabel="No rules in the current published bundle yet."
          rules={publishedApprovedRules}
          actionsEnabled={snapshot.canMutate}
        />
        <RuleBucket title="Draft rules" emptyLabel="No draft rules yet." rules={draftRules} editable actionsEnabled={snapshot.canMutate} />
      </section>

      <section className="space-y-5">
        <RuleBucket
          title="Previous versions"
          description="Older approved versions stay visible for review but are not included in new bundles."
          emptyLabel="No previous versions yet."
          rules={previousVersionRules}
          actionsEnabled={snapshot.canMutate}
        />
        <RuleBucket title="Rejected rules" emptyLabel="No rejected rules yet." rules={rejectedRules} actionsEnabled={snapshot.canMutate} />
        <RuleBucket
          title="Archived rules"
          description="Archived rules can be restored as drafts or deleted from the authoring table."
          emptyLabel="No archived rules yet."
          rules={archivedRules}
          actionsEnabled={snapshot.canMutate}
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
    <header className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(520px,0.9fr)] 2xl:items-end">
      <div>
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-accord-primary">{companyName} / Policy authoring</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.04em] text-accord-text">Policies</h1>
        <p className="mt-3 max-w-4xl text-base leading-7 text-accord-muted">
          Turn policy documents into enforceable browser controls for Accord Guard.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <HeaderStatus label="Database" value="Supabase live" tone="success" />
        <HeaderStatus label="Guard bundle" value={latestBundleVersion ? `v${latestBundleVersion}` : "Not published"} />
        <HeaderStatus label="Changes" value={pendingPublishCount ? `${pendingPublishCount} pending` : "Current"} tone={pendingPublishCount ? "warning" : "success"} />
      </div>
    </header>
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
    <section className="overflow-hidden rounded-[1.6rem] border border-accord-border bg-white shadow-accord-panel">
      <div className="grid gap-6 border-b border-accord-border bg-gradient-to-br from-white via-white to-[#f3f4ff] p-6 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.34fr)] xl:items-center">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-accord-primary">Current Guard bundle</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-accord-text">
            {latestBundleVersion ? `Bundle v${latestBundleVersion}` : "No bundle published"}
          </h2>
          <p className="mt-3 max-w-4xl text-[15px] leading-7 text-accord-muted">
            Approved rules ship as a compact bundle for the extension. The dashboard stores rule metadata and bundle history, not raw prompts.
          </p>
        </div>

        <div className="rounded-2xl border border-accord-border bg-white/85 p-4 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-accord-text">Deployment</p>
              <p className="mt-1 text-sm leading-6 text-accord-muted">
                {pendingPublishCount ? `${pendingPublishCount} change${pendingPublishCount === 1 ? "" : "s"} waiting.` : "Current for Accord Guard."}
              </p>
            </div>
            <span
              className={cn(
                "mt-1 h-2.5 w-2.5 rounded-full shadow-[0_0_18px_rgba(98,91,255,0.55)]",
                pendingPublishCount ? "bg-amber-400" : "bg-accord-primary"
              )}
            />
          </div>

          {canMutate ? (
            <form action={publishBundleAction} className="mt-4">
              <input type="hidden" name="companySlug" value={companySlug} />
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accord-night px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5"
              >
                <UploadCloud className="h-4 w-4" aria-hidden="true" />
                Publish bundle
              </button>
            </form>
          ) : (
            <div className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#f1f2ff] px-4 py-3 text-sm font-semibold text-accord-primary">
              <BadgeCheck className="h-4 w-4" aria-hidden="true" />
              Bundle active
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-5">
        {counts.map((count) => (
          <PolicyCount key={count.label} {...count} />
        ))}
      </div>
    </section>
  );
}

function HeaderStatus({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "success" | "warning" }) {
  return (
    <div className="rounded-2xl border border-accord-border bg-white/80 px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-400">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            tone === "success" && "bg-emerald-400",
            tone === "warning" && "bg-amber-400",
            tone === "default" && "bg-accord-primary"
          )}
        />
        <p className="text-sm font-semibold text-accord-text">{value}</p>
      </div>
    </div>
  );
}

function PolicyCount({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-2xl border border-accord-border bg-accord-soft/70 px-5 py-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-accord-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-accord-text">{value}</p>
      <p className="mt-2 text-xs font-medium text-accord-muted">{detail}</p>
    </div>
  );
}

function PolicyRuleForm({ disabled, companySlug }: { disabled: boolean; companySlug: string }) {
  if (disabled) return <PolicyAuthoringSetup />;

  return (
    <section className="rounded-[1.6rem] border border-accord-border bg-white/95 p-7 shadow-accord-panel 2xl:p-8">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px] xl:items-start">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-[#f1f2ff] p-3 text-accord-primary">
            <Plus className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.13em] text-accord-primary">Policy authoring</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-accord-text">Create rules</h2>
            <p className="mt-2 max-w-3xl text-base leading-7 text-accord-muted">
              Import an existing policy document or write one control directly. Everything starts as a draft.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-accord-border bg-accord-mist p-4">
          <p className="text-sm font-semibold text-accord-text">Authoring flow</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-accord-muted">
            <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-accord-border">Draft</span>
            <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-accord-border">Approve</span>
            <span className="rounded-full bg-white px-2.5 py-1 ring-1 ring-accord-border">Publish</span>
          </div>
        </div>
      </div>

      <div className="mt-7">
        <PolicyImportPanel companySlug={companySlug} />
      </div>

      <div className="mt-8 border-t border-accord-border pt-7">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-400">Manual entry</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-accord-text">Manual rule</h3>
          <p className="mt-2 max-w-3xl text-[15px] leading-7 text-accord-muted">
            Use this when the policy control is already clear.
          </p>
        </div>

        <form action={createRuleAction} className="mt-6 grid gap-6">
          <input type="hidden" name="companySlug" value={companySlug} />
          <PolicyFields />
          <button
            type="submit"
            className="rounded-xl bg-accord-night px-5 py-4 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5"
          >
            Save draft rule
          </button>
        </form>
      </div>
    </section>
  );
}

function PolicyAuthoringSetup() {
  return (
    <section className="rounded-[1.35rem] border border-accord-border bg-white/95 p-6 shadow-accord-panel">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-[#f1f2ff] p-2 text-accord-primary">
          <Plus className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-accord-text">Enable policy authoring</h2>
          <p className="mt-1 text-[15px] leading-6 text-accord-muted">
            The published v1 bundle is active for Accord Guard, but Supabase REST has not exposed the policy authoring tables yet.
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-accord-border bg-accord-mist p-4">
        <p className="text-sm font-semibold text-accord-text">To add or edit rules:</p>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-600">
          <li>Run this in the Supabase SQL Editor.</li>
          <li>Wait a few seconds, then refresh this page.</li>
          <li>Use the form to save a draft, approve it, then publish the bundle.</li>
        </ol>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-accord-night p-4 text-xs leading-6 text-slate-100">
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
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
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

      <div className="grid gap-4 2xl:grid-cols-[minmax(280px,0.65fr)_minmax(0,1.35fr)]">
        <TextArea
          label="Data categories"
          name="dataCategories"
          defaultValue={
            rule?.dataCategories.join(", ") ||
            "client_identifying_info, personal_data, address, account, veterinary_medical_record, payment_information"
          }
          rows={5}
        />
        <TextArea
          label="Supporting excerpt"
          name="supportingExcerpt"
          defaultValue={
            rule?.supportingExcerpt ||
            "Employees must not submit client names, addresses, account numbers, veterinary medical records, payment information, or other identifying information to personal or unapproved AI services. When identifying information can be removed without preventing the task, it must be removed before submission. If adequate de-identification is not possible, the submission must be blocked or routed for approval."
          }
          rows={5}
        />
      </div>

      <TextArea
        label="Employee-facing explanation"
        name="employeeExplanation"
        defaultValue={
          rule?.employeeExplanation ||
          "Client identifying information cannot be sent to personal AI. Accord will remove identifiers when it can do so safely, otherwise the submission is blocked or routed for approval."
        }
        rows={3}
      />
    </>
  );
}

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
    <label className="grid gap-2 text-[13px] font-semibold text-accord-text">
      {label}
      <input
        className="rounded-xl border border-accord-border bg-white px-3.5 py-3 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-accord-primary"
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
      />
    </label>
  );
}

function SelectField({ label, name, defaultValue, options }: { label: string; name: string; defaultValue: string; options: string[] }) {
  return (
    <label className="grid gap-2 text-[13px] font-semibold text-accord-text">
      {label}
      <select
        className="rounded-xl border border-accord-border bg-white px-3.5 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-accord-primary"
        name={name}
        defaultValue={defaultValue}
      >
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
    <label className="grid gap-2 text-[13px] font-semibold text-accord-text">
      {label}
      <textarea
        className="resize-y rounded-xl border border-accord-border bg-white px-3.5 py-3 text-sm font-medium leading-6 text-slate-700 outline-none transition focus:border-accord-primary"
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
  actionsEnabled = true
}: {
  title: string;
  description?: string;
  rules: AccordPolicyRule[];
  emptyLabel: string;
  editable?: boolean;
  actionsEnabled?: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-[1.35rem] border border-accord-border bg-white/95 shadow-accord-panel">
      <div className="flex items-start justify-between gap-4 border-b border-accord-border bg-gradient-to-r from-white to-[#f4f2ff] px-6 py-5">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-accord-text">{title}</h2>
          {description ? <p className="mt-2 text-[15px] leading-6 text-accord-muted">{description}</p> : null}
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-accord-primary shadow-sm ring-1 ring-accord-border">{rules.length}</span>
      </div>

      <div className="grid gap-4 p-5">
        {rules.length ? (
          rules.map((rule) => <PolicyRuleCard key={rule.id} rule={rule} editable={editable && actionsEnabled} actionsEnabled={actionsEnabled} />)
        ) : (
          <p className="rounded-2xl border border-dashed border-accord-border bg-accord-mist/80 p-5 text-sm text-accord-muted">
            {emptyLabel}
          </p>
        )}
      </div>
    </section>
  );
}

function PolicyRuleCard({ rule, editable, actionsEnabled }: { rule: AccordPolicyRule; editable: boolean; actionsEnabled: boolean }) {
  return (
    <details className="group w-full max-w-[30rem] rounded-2xl border border-accord-border bg-white shadow-sm transition-[max-width,border-color,box-shadow] duration-300 open:max-w-none open:border-accord-primary/30 open:shadow-accord-panel">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-4 outline-none transition hover:bg-accord-mist/50 sm:p-5 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0 max-w-[28rem]">
          <RuleStatusRow rule={rule} />
          <h3 className="mt-3 text-[17px] font-semibold leading-6 text-accord-text">{rule.name}</h3>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-slate-400">{rule.ruleKey}</p>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <span className="hidden rounded-full bg-accord-mist px-3 py-1 text-xs font-semibold text-accord-muted group-open:hidden sm:inline-flex">
            View details
          </span>
          <span className="hidden rounded-full bg-[#f1f2ff] px-3 py-1 text-xs font-semibold text-accord-primary group-open:inline-flex">
            Hide details
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition duration-300 group-open:rotate-180" aria-hidden="true" />
        </div>
      </summary>

      <div className="grid grid-rows-[0fr] overflow-hidden px-5 transition-[grid-template-rows] duration-300 ease-out group-open:grid-rows-[1fr]">
        <div className="min-h-0 overflow-hidden">
          <div className="border-t border-accord-border py-5">
            <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.38fr)] xl:items-start">
              <div className="space-y-5">
                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Employee explanation</p>
                  <p className="mt-2 text-[15px] leading-7 text-slate-600">{rule.employeeExplanation}</p>
                </div>

                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Supporting excerpt</p>
                  <p className="mt-2 rounded-2xl border border-accord-border bg-accord-mist/70 p-4 text-sm leading-7 text-slate-600">
                    {rule.supportingExcerpt}
                  </p>
                </div>

                <div>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Data categories</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {rule.dataCategories.map((category) => (
                      <span key={category} className="rounded-full bg-[#f1f2ff] px-2.5 py-1 text-[12px] font-semibold text-accord-primary">
                        {category.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <aside className="rounded-2xl border border-accord-border bg-accord-mist/70 p-4">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Rule details</p>
                <div className="mt-4 grid gap-3">
                  <RuleMeta label="Source" value={`${rule.sourcePolicyName} ${rule.sourceSection}`} />
                  <RuleMeta label="Provider" value={rule.aiProvider} />
                  <RuleMeta label="Destination" value={rule.destinationType} />
                  <RuleMeta label="Action" value={rule.action} />
                  <RuleMeta label="Fallback" value={rule.fallbackAction} />
                  <RuleMeta label="Severity" value={rule.severity} />
                  <RuleMeta label="Effective" value={rule.effectiveDate} />
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {actionsEnabled && rule.status === "draft" ? (
                    <>
                      <RuleActionButton action={approveRuleAction} ruleId={rule.id} label="Approve" icon="approve" />
                      <RuleActionButton action={rejectRuleAction} ruleId={rule.id} label="Reject" />
                    </>
                  ) : null}
                  {actionsEnabled && rule.status === "approved" ? <RuleActionButton action={archiveRuleAction} ruleId={rule.id} label="Archive" icon="archive" /> : null}
                  {actionsEnabled && rule.status === "archived" ? (
                    <>
                      <RuleActionButton action={restoreRuleAction} ruleId={rule.id} label="Restore draft" icon="restore" />
                      <RuleActionButton action={deleteRuleAction} ruleId={rule.id} label="Delete" icon="delete" tone="danger" />
                    </>
                  ) : null}
                </div>
              </aside>
            </div>

            {editable ? (
              <details className="mt-5 rounded-xl border border-accord-border bg-white p-4">
                <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-accord-text">
                  <PencilLine className="h-4 w-4" aria-hidden="true" />
                  Edit draft
                </summary>
                <form action={updateDraftRuleAction} className="mt-4 grid gap-4">
                  <input type="hidden" name="ruleId" value={rule.id} />
                  <PolicyFields rule={rule} />
                  <button type="submit" className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-accord-text shadow-sm ring-1 ring-accord-border">
                    Save draft changes
                  </button>
                </form>
              </details>
            ) : null}
          </div>
        </div>
      </div>
    </details>
  );
}

function RuleStatusRow({ rule }: { rule: AccordPolicyRule }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusPill status={rule.status} />
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">rule v{rule.version}</span>
      {rule.status === "approved" ? (
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold",
            rule.publishedInLatestBundle && "bg-[#f1f2ff] text-accord-primary",
            rule.active && !rule.publishedInLatestBundle && "bg-amber-50 text-amber-700",
            !rule.active && "bg-slate-100 text-slate-500"
          )}
        >
          {rule.publishedInLatestBundle
            ? `published in bundle v${rule.publishedInBundleVersion}`
            : rule.active
              ? "pending publish"
              : "previous rule version"}
        </span>
      ) : null}
    </div>
  );
}

function RuleMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-accord-border/70 pb-2 last:border-b-0 last:pb-0">
      <span className="text-xs font-semibold text-slate-400">{label}</span>
      <span className="text-right text-sm font-semibold text-accord-text">{value.replace(/_/g, " ")}</span>
    </div>
  );
}

function RuleActionButton({
  action,
  ruleId,
  label,
  icon,
  tone = "default"
}: {
  action: (formData: FormData) => Promise<void>;
  ruleId: string;
  label: string;
  icon?: "approve" | "archive" | "restore" | "delete";
  tone?: "default" | "danger";
}) {
  const Icon = icon === "approve" ? BadgeCheck : icon === "archive" ? Archive : icon === "restore" ? RotateCcw : icon === "delete" ? Trash2 : FileText;

  return (
    <form action={action}>
      <input type="hidden" name="ruleId" value={ruleId} />
      <button
        type="submit"
        className={cn(
          "inline-flex items-center gap-2 whitespace-nowrap rounded-full border bg-white px-3 py-1.5 text-xs font-semibold shadow-sm transition",
          tone === "danger"
            ? "border-rose-200 text-rose-700 hover:border-rose-400 hover:text-rose-800"
            : "border-accord-border text-accord-text hover:border-accord-primary hover:text-accord-primary"
        )}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </button>
    </form>
  );
}

function StatusPill({ status }: { status: PolicyRuleStatus }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-semibold",
        status === "approved" && "bg-[#f1f2ff] text-accord-primary",
        status === "draft" && "bg-amber-50 text-amber-700",
        status === "rejected" && "bg-rose-50 text-rose-700",
        status === "archived" && "bg-slate-100 text-slate-600"
      )}
    >
      {status}
    </span>
  );
}

function BundleHistory({ bundles }: { bundles: Array<{ id: string; version: number; status: string; checksum: string; ruleCount: number; publishedAt: string }> }) {
  return (
    <section className="rounded-[1.35rem] border border-accord-border bg-white/95 p-6 shadow-accord-panel">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-[#f1f2ff] p-2 text-accord-primary">
          <Clock3 className="h-4 w-4" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-accord-text">Policy bundle history</h2>
          <p className="mt-1 text-[15px] leading-6 text-accord-muted">Published bundles are what Accord Guard can fetch and cache.</p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {bundles.length ? (
          bundles.map((bundle) => (
            <div key={bundle.id} className="flex flex-col gap-2 rounded-xl border border-accord-border bg-accord-mist px-4 py-3.5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-[15px] font-semibold text-accord-text">
                  v{bundle.version} <span className="font-normal text-slate-500">{bundle.status}</span>
                </p>
                <p className="mt-1 font-mono text-[11px] text-slate-500">{bundle.checksum.slice(0, 24)}</p>
              </div>
              <p className="text-sm font-semibold text-slate-600">{bundle.ruleCount} rules</p>
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-accord-border bg-accord-mist p-5 text-sm text-accord-muted">
            Publish approved rules to create the first bundle.
          </p>
        )}
      </div>
    </section>
  );
}
