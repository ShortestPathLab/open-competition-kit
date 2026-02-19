interface TrackCardProps {
  name: string
  description: string
  imageUrl?: string
}

export function TrackCard({ name, description, imageUrl }: TrackCardProps) {
  return (
    <div className="flex overflow-hidden rounded-lg border border-border">
      <div className="w-48 shrink-0 bg-muted">
        {imageUrl && (
          <img src={imageUrl} alt={name} className="h-full w-full object-cover" />
        )}
      </div>
      <div className="flex flex-col justify-between p-4">
        <div>
          <h3 className="font-semibold">{name}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button className="rounded-md border border-border px-3 py-1.5 text-sm">
            More info
          </button>
          <button className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground">
            Get started
          </button>
        </div>
      </div>
    </div>
  )
}
