"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addOrganizationMemberFromForm,
  resendOrganizationInviteFromForm,
  updateOrganizationNameFromForm
} from "@/lib/auth/organization";

export async function addMemberAction(formData: FormData) {
  const result = await addOrganizationMemberFromForm(formData);
  revalidatePath("/organization");
  revalidatePath("/settings");
  redirect(`/organization?member=${result.ok ? (result.emailSent ? "invited" : "added") : "error"}#organization-settings`);
}

export async function resendMemberInviteAction(formData: FormData) {
  const result = await resendOrganizationInviteFromForm(formData);
  revalidatePath("/organization");
  revalidatePath("/settings");
  redirect(`/organization?member=${result.ok ? (result.emailSent ? "resent" : "added") : "error"}#organization-settings`);
}

export async function updateWorkspaceAction(formData: FormData) {
  const result = await updateOrganizationNameFromForm(formData);
  revalidatePath("/organization");
  revalidatePath("/settings");
  revalidatePath("/dashboard");
  redirect(`/organization?workspace=${result.ok ? "saved" : "error"}#organization-settings`);
}
