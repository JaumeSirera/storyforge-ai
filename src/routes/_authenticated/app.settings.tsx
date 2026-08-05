import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyApiKeys, saveMyApiKeys } from "@/lib/user-keys.functions";
import { getMyEmailSettings, saveMyEmailSettings } from "@/lib/email-settings.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { KeyRound, Trash2, Mail } from "lucide-react";

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
      />
    </div>
  );
}

function KeyCard({
  title, description, masked, has, value, onChange, onSave, onClear, placeholder, saving,
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
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
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
