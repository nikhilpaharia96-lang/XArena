"use client";
import { useState } from "react";
import { useAdminBanners, useCreateBanner } from "@/hooks/use-admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "@/lib/toast-store";
import { ApiClientError } from "@/lib/api-client";
import { Image as ImageIcon, Plus } from "lucide-react";
export default function AdminBannersPage() {
  const { data, isLoading } = useAdminBanners();
  const createBanner = useCreateBanner();
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const handleCreate = () => {
    if (!title || !imageUrl) {
      toast({ title: "Title and image URL are required", tone: "error" });
      return;
    }
    createBanner.mutate(
      { title, imageUrl, linkUrl: linkUrl || undefined, sortOrder: data?.length ?? 0 },
      {
        onSuccess: () => {
          toast({ title: "Banner created", tone: "success" });
          setTitle(""); setImageUrl(""); setLinkUrl("");
        },
        onError: (err) => toast({ title: "Failed", description: err instanceof ApiClientError ? err.message : "", tone: "error" }),
      }
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-white">Banners</h1>

      <Card className="p-5 space-y-3">
        <h2 className="font-bold text-white text-sm flex items-center gap-1.5"><Plus className="h-4 w-4" /> Add Banner</h2>
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input placeholder="Image URL" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
        <Input placeholder="Link URL (optional)" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
        <Button loading={createBanner.isPending} onClick={handleCreate}>Create Banner</Button>
      </Card>

      {isLoading ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : data && data.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {data.map((b) => (
            <Card key={b.id} className="overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.imageUrl} alt={b.title} className="w-full h-32 object-cover" />
              <div className="p-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-white">{b.title}</p>
                <Badge tone={b.isActive ? "signal" : "neutral"}>{b.isActive ? "Active" : "Inactive"}</Badge>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={ImageIcon} title="No banners yet" />
      )}
    </div>
  );
}
