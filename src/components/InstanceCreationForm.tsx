import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, Loader2 } from "lucide-react";
import { SodiumToggle } from "@/components/SodiumToggle";
import { invoke } from "@tauri-apps/api/core";
import { motion } from "framer-motion";

export function InstanceCreationForm() {
  const [formData, setFormData] = useState<{
    name: string;
    gameVersion: string;
    loader: string;
    includeSodium: boolean;
  }>({
    name: "",
    gameVersion: "1.21.1",
    loader: "fabric",
    includeSodium: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [sodiumStatus, setSodiumStatus] = useState<"idle" | "downloading" | "success" | "error">(
    "idle",
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSodiumStatus(formData.includeSodium ? "downloading" : "idle");

    try {
      await invoke("create_instance", {
        name: formData.name,
        gameVersion: formData.gameVersion,
        loader: formData.loader,
        includeSodium: formData.includeSodium,
      });
      if (formData.includeSodium) {
        setSodiumStatus("success");
      }
    } catch (err) {
      console.error("Instance creation failed:", err);
      if (formData.includeSodium) {
        setSodiumStatus("error");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="mx-auto max-w-2xl space-y-6 p-6"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Basic Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="instance-name">Instance Name</Label>
              <Input
                id="instance-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={isLoading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="game-version">Game Version</Label>
              <Input
                id="game-version"
                value={formData.gameVersion}
                onChange={(e) => setFormData({ ...formData, gameVersion: e.target.value })}
                disabled={isLoading}
                required
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Mod Loader</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="loader-select">Loader</Label>
              <Select
                value={formData.loader}
                onValueChange={(value: string | null) => {
                  if (value) setFormData({ ...formData, loader: value });
                }}
                disabled={isLoading}
              >
                <SelectTrigger id="loader-select">
                  <SelectValue placeholder="Select loader" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fabric">Fabric</SelectItem>
                  <SelectItem value="forge">Forge</SelectItem>
                  <SelectItem value="quilt">Quilt</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance Mods</CardTitle>
          </CardHeader>
          <CardContent>
            <SodiumToggle
              checked={formData.includeSodium}
              onCheckedChange={(checked) => setFormData({ ...formData, includeSodium: checked })}
              isDownloading={sodiumStatus === "downloading"}
              downloadStatus={sodiumStatus === "downloading" ? "idle" : sodiumStatus}
            />
          </CardContent>
        </Card>

        <Collapsible>
          <div className="flex w-full items-center justify-between">
            <CardTitle className="text-base">Advanced</CardTitle>
            <CollapsibleTrigger>
              <Button variant="ghost" size="sm" className="p-0">
                <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent>
            <Card className="mt-2">
              <CardContent className="space-y-4 pt-6">
                <div className="space-y-2">
                  <Label htmlFor="jvm-args">JVM Arguments</Label>
                  <Input id="jvm-args" disabled={isLoading} placeholder="-Xmx2G" />
                </div>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full bg-[#ffcea7] hover:bg-[#ffcea7]/90"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating Instance...
            </>
          ) : (
            "Create Instance"
          )}
        </Button>
      </form>
    </motion.div>
  );
}
