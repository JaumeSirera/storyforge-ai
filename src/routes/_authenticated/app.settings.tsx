import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyApiKeys, saveMyApiKeys } from "@/lib/user-keys.functions";
import { getMyEmailSettings, saveMyEmailSettings } from "@/lib/email-settings.functions";
import { supabase } from "@/integrations/supabase/client";
import { loadLogoDataUrl } from "@/lib/email-report";
import { TurnSettingsCard } from "@/components/TurnSettingsCard";
import { ExternalDatabaseCard } from "@/components/ExternalDatabaseCard";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { KeyRound, Trash2, Mail, ExternalLink, FlaskConical } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const getKeys = useServerFn(getMyApiKeys);
  const saveKeys = useServerFn(saveMyApiKeys);

  const { data, isLoading } = useQuery({
    queryKey: ["my-api-keys"],
    queryFn: () => getKeys(),
  });

  const [openai, setOpenai] = useState("");
  const [gemini, setGemini] = useState("");
  const [replicate, setReplicate] = useState("");
  const [eleven, setEleven] = useState("");
  const [provider, setProvider] = useState<"openai" | "gemini">("gemini");

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) => saveKeys({ data: payload }),
    onSuccess: () => {
      toast.success("Claves guardadas");
      setOpenai(""); setGemini(""); setReplicate(""); setEleven("");
      qc.invalidateQueries({ queryKey: ["my-api-keys"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) {
    return <div className="text-muted-foreground">Cargando…</div>;
  }

  const currentProvider = data.textProvider;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <KeyRound className="h-6 w-6" /> Claves de IA
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Cada usuario paga sus propias llamadas. Las claves se guardan cifradas y solo
          se muestran enmascaradas. Deja un campo en blanco para no modificarlo.
        </p>
      </div>

      <EmailSettingsCard />

      <TurnSettingsCard />

      <ExternalDatabaseCard />



      <Card>
        <CardHeader>
          <CardTitle>Proveedor de texto</CardTitle>
          <CardDescription>
            Modelo por defecto para generar historias, preguntas e informes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Actual: <span className="font-medium text-foreground">{currentProvider === "openai" ? "OpenAI" : "Google Gemini"}</span>
          </div>
          <Select value={provider} onValueChange={(v) => setProvider(v as "openai" | "gemini")}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gemini">Google Gemini</SelectItem>
              <SelectItem value="openai">OpenAI</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={() => save.mutate({ textProvider: provider })}
            disabled={save.isPending || provider === currentProvider}
          >
            Guardar proveedor
          </Button>
          <div className="pt-2">
            <Button asChild size="sm" variant="outline">
              <Link to="/app/ai-test">
                <FlaskConical className="h-4 w-4" aria-hidden /> Probar IA y fallback
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <KeyCard
        title="OpenAI"
        description="Usada para texto (si eliges OpenAI como proveedor)."
        masked={data.openaiKeyMasked}
        has={data.hasOpenai}
        value={openai}
        onChange={setOpenai}
        onSave={() => save.mutate({ openaiKey: openai })}
        onClear={() => save.mutate({ openaiKey: null })}
        placeholder="sk-..."
        saving={save.isPending}
        signupUrl="https://platform.openai.com/signup"
        keyUrl="https://platform.openai.com/api-keys"
      />

      <KeyCard
        title="Google Gemini"
        description="Usada para texto (proveedor por defecto) y para generar imágenes de personajes."
        masked={data.geminiKeyMasked}
        has={data.hasGemini}
        value={gemini}
        onChange={setGemini}
        onSave={() => save.mutate({ geminiKey: gemini })}
        onClear={() => save.mutate({ geminiKey: null })}
        placeholder="AIza..."
        saving={save.isPending}
        signupUrl="https://aistudio.google.com/"
        keyUrl="https://aistudio.google.com/app/apikey"
      />

      <KeyCard
        title="Replicate"
        description="Usada para generar vídeo (t2v / i2v) y lip-sync."
        masked={data.replicateKeyMasked}
        has={data.hasReplicate}
        value={replicate}
        onChange={setReplicate}
        onSave={() => save.mutate({ replicateKey: replicate })}
        onClear={() => save.mutate({ replicateKey: null })}
        placeholder="r8_..."
        saving={save.isPending}
        signupUrl="https://replicate.com/signin"
        keyUrl="https://replicate.com/account/api-tokens"
      />

      <KeyCard
        title="ElevenLabs"
        description="Usada para sintetizar la voz de los personajes."
        masked={data.elevenlabsKeyMasked}
        has={data.hasElevenlabs}
        value={eleven}
        onChange={setEleven}
        onSave={() => save.mutate({ elevenlabsKey: eleven })}
        onClear={() => save.mutate({ elevenlabsKey: null })}
        placeholder="sk_..."
        saving={save.isPending}
        signupUrl="https://elevenlabs.io/app/sign-up"
        keyUrl="https://elevenlabs.io/app/settings/api-keys"
      />

    </div>
  );
}

function KeyCard({
  title, description, masked, has, value, onChange, onSave, onClear, placeholder, saving,
  signupUrl, keyUrl,
}: {
  title: string;
  description: string;
  masked: string | null;
  has: boolean;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onClear: () => void;
  placeholder: string;
  saving: boolean;
  signupUrl: string;
  keyUrl: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>
          {description}
          <span className="mt-2 flex flex-wrap gap-3">
            <a
              href={keyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
            >
              Obtener clave de {title} <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
            <a
              href={signupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-muted-foreground underline underline-offset-2"
            >
              Crear cuenta <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </span>
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="text-sm">
          Estado:{" "}
          {has ? (
            <span className="text-emerald-600 font-medium">Configurada ({masked})</span>
          ) : (
            <span className="text-muted-foreground">Sin configurar</span>
          )}
        </div>
        <div className="space-y-2">
          <Label>Nueva clave</Label>
          <Input
            type="password"
            autoComplete="off"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={onSave} disabled={saving || !value.trim()}>
            Guardar
          </Button>
          {has && (
            <Button size="sm" variant="outline" onClick={onClear} disabled={saving}>
              <Trash2 className="h-4 w-4 mr-1" /> Borrar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EmailSettingsCard() {
  const qc = useQueryClient();
  const load = useServerFn(getMyEmailSettings);
  const persist = useServerFn(saveMyEmailSettings);

  const { data, isLoading } = useQuery({
    queryKey: ["my-email-settings"],
    queryFn: () => load(),
  });

  const [fromName, setFromName] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [replyTo, setReplyTo] = useState("");
  const [subjectTemplate, setSubjectTemplate] = useState("");
  const [bodyTemplate, setBodyTemplate] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [autoSend, setAutoSend] = useState(false);

  useEffect(() => {
    if (!data) return;
    setFromName(data.fromName);
    setFromEmail(data.fromEmail);
    setReplyTo(data.replyTo);
    setSubjectTemplate(data.subjectTemplate);
    setBodyTemplate(data.bodyTemplate);
    setLogoUrl(data.logoUrl ?? "");
    setAutoSend(Boolean((data as any).autoSendOnComplete));
  }, [data]);


  useEffect(() => {
    let alive = true;
    if (!logoUrl) {
      setLogoPreview(null);
      return;
    }
    loadLogoDataUrl(logoUrl).then((url) => {
      if (alive) setLogoPreview(url);
    });
    return () => {
      alive = false;
    };
  }, [logoUrl]);

  const save = useMutation({
    mutationFn: () =>
      persist({
        data: { fromName, fromEmail, replyTo, subjectTemplate, bodyTemplate, logoUrl, autoSendOnComplete: autoSend },
      }),
    onSuccess: () => {
      toast.success("Configuración de correo guardada");
      qc.invalidateQueries({ queryKey: ["my-email-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function uploadLogo(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("El logo debe pesar menos de 2 MB");
      return;
    }
    setUploading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) throw new Error("Sesión no válida");
      const ext = file.name.toLowerCase().endsWith(".jpg") || file.name.toLowerCase().endsWith(".jpeg")
        ? "jpg"
        : "png";
      const path = `${uid}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("branding")
        .upload(path, file, { upsert: true, contentType: file.type || `image/${ext}` });
      if (error) throw new Error(error.message);
      setLogoUrl(path);
      await persist({ data: { logoUrl: path } });
      qc.invalidateQueries({ queryKey: ["my-email-settings"] });
      toast.success("Logo subido");
    } catch (e: any) {
      toast.error(e.message || "No se pudo subir el logo");
    } finally {
      setUploading(false);
    }
  }

  async function removeLogo() {
    setLogoUrl("");
    await persist({ data: { logoUrl: "" } });
    qc.invalidateQueries({ queryKey: ["my-email-settings"] });
    toast.success("Logo eliminado");
  }


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Mail className="h-4 w-4" /> Correo de envío
        </CardTitle>
        <CardDescription>
          Configura el remitente con el que se enviarán los correos (por ejemplo, los
          informes a los candidatos) y el asunto y mensaje por defecto.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Cargando…</div>
        ) : (
          <>
            <div className="space-y-2">
              <Label>Logo de la empresa</Label>
              <div className="flex items-center gap-3">
                <div className="h-16 w-28 rounded-md border border-border bg-muted/40 flex items-center justify-center overflow-hidden">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo de la empresa" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin logo</span>
                  )}
                </div>
                <div className="space-y-2">
                  <Input
                    type="file"
                    accept="image/png,image/jpeg"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadLogo(f);
                      e.target.value = "";
                    }}
                    className="max-w-xs"
                  />
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-muted-foreground">PNG o JPG, máx. 2 MB.</p>
                    {logoUrl && (
                      <Button variant="ghost" size="sm" onClick={() => void removeLogo()}>
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Quitar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Se usa en la cabecera del informe PDF que se envía a los candidatos.
              </p>
            </div>


            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="from-name">Nombre visible</Label>
                <Input
                  id="from-name"
                  placeholder="Xandralyze"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="from-email">Correo del remitente</Label>
                <Input
                  id="from-email"
                  type="email"
                  autoComplete="off"
                  placeholder="informes@tudominio.com"
                  value={fromEmail}
                  onChange={(e) => setFromEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reply-to">Responder a (opcional)</Label>
              <Input
                id="reply-to"
                type="email"
                autoComplete="off"
                placeholder="rrhh@tudominio.com"
                value={replyTo}
                onChange={(e) => setReplyTo(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="subject-tpl">Asunto por defecto</Label>
              <Input
                id="subject-tpl"
                value={subjectTemplate}
                onChange={(e) => setSubjectTemplate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="body-tpl">Mensaje por defecto</Label>
              <Textarea
                id="body-tpl"
                rows={5}
                value={bodyTemplate}
                onChange={(e) => setBodyTemplate(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Puedes usar {"{{candidato}}"} y {"{{simulacion}}"} como campos dinámicos.
              </p>
            </div>

            <div className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
              <div className="space-y-1">
                <Label htmlFor="auto-send">Enviar el informe automáticamente al finalizar</Label>
                <p className="text-xs text-muted-foreground">
                  Cuando un candidato termina la simulación, el informe se prepara con esta
                  configuración y queda registrado en el historial de la sesión.
                </p>
              </div>
              <Switch id="auto-send" checked={autoSend} onCheckedChange={setAutoSend} />
            </div>

            <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
              Guardar configuración
            </Button>

          </>
        )}
      </CardContent>
    </Card>
  );
}

