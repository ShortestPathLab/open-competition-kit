import { Upload } from "lucide-react"

export function IconUpload() {
  return (
    <div className="flex items-center gap-4">
      <div className="h-16 w-16 shrink-0 rounded-full bg-muted" />
      <div className="flex flex-1 flex-col items-center justify-center rounded-lg border-2 border-dashed border-border p-6">
        <Upload className="h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-sm">
          <span className="font-medium text-primary cursor-pointer">Click to upload</span>{" "}
          or drag and drop
        </p>
        <p className="text-xs text-muted-foreground">SVG, PNG, JPG or GIF (max. 800x400px)</p>
      </div>
    </div>
  )
}
