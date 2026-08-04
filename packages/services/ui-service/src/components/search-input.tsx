import { Search } from "lucide-react"
import type { InputHTMLAttributes } from "react"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  placeholder?: string
  className?: string
}

export function SearchInput({
  placeholder = "Search",
  className,
  ...props
}: SearchInputProps) {
  return (
    <InputGroup className={className}>
      <InputGroupInput
        type="text"
        placeholder={placeholder}
        {...props}
      />
      <InputGroupAddon align="inline-end">
        <Search className="text-muted-foreground" />
      </InputGroupAddon>
    </InputGroup>
  )
}
