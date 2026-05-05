import { Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { t } from "@/lib/i18n";
import type { CreateInstanceInput } from "@/lib/ipc";
import { fetchLoaderOptions, fetchMinecraftVersions } from "@/lib/minecraft-catalog";
import { loaderSchema, type Language } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const createInstanceFormSchema = z.object({
  name: z.string().trim().min(1, "Instance name is required"),
  mcVersion: z
    .string()
    .trim()
    .min(1, "Minecraft version is required")
    .regex(/^\d+(\.\d+){1,3}([\w.-]+)?$/, "Use a valid version like 1.20.1"),
  loader: loaderSchema,
  modpackName: z.string().trim().max(100, "Keep modpack name under 100 characters").optional(),
});

type FieldKey = keyof z.infer<typeof createInstanceFormSchema>;

type CreateInstanceSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (input: CreateInstanceInput) => Promise<void>;
  lang: Language;
};

export function CreateInstanceSheet({
  open,
  onOpenChange,
  onCreate,
  lang,
}: CreateInstanceSheetProps) {
  const [name, setName] = useState("");
  const [mcVersion, setMcVersion] = useState("1.20.1");
  const [loader, setLoader] = useState<z.infer<typeof loaderSchema>>("fabric");
  const [modpackName, setModpackName] = useState("");
  const [versionOptions, setVersionOptions] = useState<string[]>([]);
  const [loaderOptions, setLoaderOptions] = useState<Array<z.infer<typeof loaderSchema>>>([
    "vanilla",
    "fabric",
    "forge",
    "neoforge",
    "quilt",
  ]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [fieldTouched, setFieldTouched] = useState<Partial<Record<FieldKey, boolean>>>({});

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    let mounted = true;

    const loadCatalog = async () => {
      setCatalogLoading(true);
      setCatalogError(null);
      try {
        const [versions, loaders] = await Promise.all([
          fetchMinecraftVersions(180),
          fetchLoaderOptions(),
        ]);
        if (!mounted) return;

        const sortedVersions = versions.map((v) => v.id);
        const nextLoaders = loaders
          .map((item) => item.toLowerCase())
          .filter((item): item is z.infer<typeof loaderSchema> =>
            ["vanilla", "fabric", "forge", "neoforge", "quilt"].includes(item),
          );

        setVersionOptions(sortedVersions);
        if (nextLoaders.length > 0) {
          setLoaderOptions(nextLoaders);
          if (!nextLoaders.includes(loader)) {
            setLoader(nextLoaders[0] ?? "vanilla");
          }
        }
        if (!sortedVersions.includes(mcVersion) && sortedVersions.length > 0) {
          setMcVersion(sortedVersions[0] ?? "1.20.1");
        }
      } catch (error) {
        if (!mounted) return;
        setCatalogError(
          error instanceof Error ? error.message : "Failed to load Minecraft catalog metadata.",
        );
      } finally {
        if (mounted) {
          setCatalogLoading(false);
        }
      }
    };

    void loadCatalog();

    return () => {
      mounted = false;
    };
  }, [open]);

  const values = useMemo(
    () => ({
      name,
      mcVersion,
      loader,
      modpackName,
    }),
    [loader, mcVersion, modpackName, name],
  );

  const validation = useMemo(() => createInstanceFormSchema.safeParse(values), [values]);
  const fieldErrors = useMemo(() => {
    if (validation.success) return {} as Partial<Record<FieldKey, string>>;
    const errors: Partial<Record<FieldKey, string>> = {};
    for (const issue of validation.error.issues) {
      const key = issue.path[0];
      if (typeof key === "string" && !errors[key as FieldKey]) {
        errors[key as FieldKey] = issue.message;
      }
    }
    return errors;
  }, [validation]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowValidation(true);
    if (!validation.success) return;

    setSubmitting(true);
    try {
      await onCreate({
        name: validation.data.name,
        mcVersion: validation.data.mcVersion,
        loader: validation.data.loader,
        modpackName: validation.data.modpackName || null,
      });
      setName("");
      setModpackName("");
      const resetVersion = versionOptions[0] ?? "1.20.1";
      const resetLoader = loaderOptions.includes("fabric")
        ? "fabric"
        : (loaderOptions[0] ?? "vanilla");
      setMcVersion(resetVersion);
      setLoader(resetLoader);
      setShowValidation(false);
      setFieldTouched({});
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  function invalidFor(field: FieldKey) {
    return Boolean(fieldErrors[field] && (showValidation || fieldTouched[field]));
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Close create instance panel"
        className="h-full flex-1 bg-black/55 backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
        type="button"
      />

      <aside
        aria-labelledby="create-instance-title"
        aria-modal="true"
        className="relative h-full w-full max-w-xl border-l border-border bg-bg/95 p-4 shadow-lift backdrop-blur md:p-6"
        role="dialog"
      >
        <div className="flex h-full flex-col">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-accent/90">
                New Instance
              </p>
              <h2 id="create-instance-title" className="mt-1 text-xl font-semibold text-text">
                {t(lang, "createInstance")}
              </h2>
              <p className="mt-1 text-sm text-textMuted">
                Create a local instance preset shell. Validation runs before dispatching to the
                store.
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label="Close create instance panel"
                    onClick={() => onOpenChange(false)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                }
              />
              <TooltipContent>Close panel</TooltipContent>
            </Tooltip>
          </div>

          <form className="flex h-full flex-col" onSubmit={(event) => void handleSubmit(event)}>
            <div className="grid gap-4">
              <Field
                error={showValidation || fieldTouched.name ? fieldErrors.name : undefined}
                helper="Shown in the library and details routes. Keep it short and unique."
                label={t(lang, "instanceName")}
              >
                <input
                  aria-invalid={invalidFor("name")}
                  className={cn("field", invalidFor("name") && "field-invalid")}
                  onBlur={() => setFieldTouched((prev) => ({ ...prev, name: true }))}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Survival Fabric"
                  value={name}
                />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  error={
                    showValidation || fieldTouched.mcVersion ? fieldErrors.mcVersion : undefined
                  }
                  helper="Live versions sourced from Mojang metadata."
                  label={t(lang, "mcVersion")}
                >
                  <Select
                    value={mcVersion}
                    onValueChange={(value) => {
                      if (!value) return;
                      setMcVersion(value);
                      setFieldTouched((prev) => ({ ...prev, mcVersion: true }));
                    }}
                  >
                    <SelectTrigger
                      className={cn("h-10", invalidFor("mcVersion") && "ring-2 ring-danger/30")}
                    >
                      <SelectValue
                        placeholder={
                          catalogLoading ? "Loading versions…" : "Select a Minecraft version"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {versionOptions.length > 0 ? (
                        versionOptions.map((version) => (
                          <SelectItem key={version} value={version}>
                            {version}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value={mcVersion}>{mcVersion}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </Field>

                <Field helper="Used for loader-specific setup and card badges." label="Loader">
                  <Select
                    value={loader}
                    onValueChange={(value) => {
                      if (!value) return;
                      setLoader(value as z.infer<typeof loaderSchema>);
                    }}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select loader" />
                    </SelectTrigger>
                    <SelectContent>
                      {loaderOptions.map((loaderOption) => (
                        <SelectItem key={loaderOption} value={loaderOption}>
                          {loaderOption === "neoforge"
                            ? "NeoForge"
                            : loaderOption.slice(0, 1).toUpperCase() + loaderOption.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <Field
                error={
                  showValidation || fieldTouched.modpackName ? fieldErrors.modpackName : undefined
                }
                helper="Optional. Used as secondary metadata in cards and table rows."
                label={t(lang, "modpackNameOptional")}
              >
                <input
                  aria-invalid={invalidFor("modpackName")}
                  className={cn("field", invalidFor("modpackName") && "field-invalid")}
                  onBlur={() => setFieldTouched((prev) => ({ ...prev, modpackName: true }))}
                  onChange={(event) => setModpackName(event.target.value)}
                  placeholder="Vanilla+ QoL"
                  value={modpackName}
                />
              </Field>
            </div>

            <div className="mt-5 rounded-lg border border-border bg-surface1/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-textMuted">
                Validation
              </p>
              <p className="mt-1 text-xs text-textMuted">
                {validation.success
                  ? "All fields look valid. You can create the instance."
                  : `${validation.error.issues.length} validation issue${validation.error.issues.length === 1 ? "" : "s"} remaining.`}
              </p>
              {catalogLoading ? (
                <div className="mt-2 flex items-center gap-2 text-xs text-textMuted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Syncing Minecraft versions and loader tags…
                </div>
              ) : null}
              {catalogError ? <p className="mt-2 text-xs text-danger">{catalogError}</p> : null}
            </div>

            <div className="mt-auto flex items-center justify-end gap-2 pt-6">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button disabled={submitting} type="submit">
                {submitting ? "Creating…" : "Create Instance"}
              </Button>
            </div>
          </form>
        </div>
      </aside>
    </div>
  );
}

type FieldProps = {
  label: string;
  helper: string;
  error?: string;
  children: React.ReactNode;
};

function Field({ label, helper, error, children }: FieldProps) {
  return (
    <label className="grid gap-1.5">
      <span className="label">{label}</span>
      {children}
      <span className={cn("helper", error && "text-danger")}>{error ?? helper}</span>
    </label>
  );
}
