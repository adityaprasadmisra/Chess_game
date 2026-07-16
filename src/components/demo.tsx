import { HolographicWall } from "@/components/ui/holographic-wall-shadcnui"

export default function Demo() {
  return (
    <div className="flex min-h-96 w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-3xl">
        <HolographicWall intensity={0.8} radius={200} />
      </div>
    </div>
  )
}
