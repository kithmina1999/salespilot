"use client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("flex flex-col gap-10 ", className)} {...props}>
      <Card className="py-10">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form >
            <FieldGroup className="space-y-4">
              <Field>
                <FieldLabel htmlFor="admin_api_key">Admin API Key</FieldLabel>
                <Input
                  id="admin_api_key"
                  type="text"
                  placeholder="Enter Admin API Key"
                  className="focus:border-amber-400 focus:ring-amber-400 focus:ring-offset-0 focus:ring-offset-transparent focus:border-2"
                  required
                />
              </Field>
              <Field>
                <Button type="submit" className="font-sans  hover:bg-neutral-200">Authenticate</Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <FieldDescription className="px-6 text-center">
        By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
        and <a href="#">Privacy Policy</a>.
      </FieldDescription>
    </div>
  )
}
