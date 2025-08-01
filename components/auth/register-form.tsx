"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import ReCAPTCHA from "react-google-recaptcha"

export function RegisterForm() {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
    jobTitle: "",
    department: "",
    workDomain: "",
    organization: "",
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target
    setFormData((prev) => ({ ...prev, [id]: value }))
  }

  const handleSelectChange = (id: string, value: string) => {
    setFormData((prev) => ({ ...prev, [id]: value }))
  }

const PASSWORD_VALIDATION_MESSAGES = {
  minLength: "Password must be at least 12 characters long",
  mustIncludeLetters: "Password must include letters",
  mustIncludeUppercase: "Password must include at least one uppercase letter",
  mustIncludeNumbers: "Password must include numbers",
  mustIncludeSpecialChar: "Password must include a special character",
};

function getPasswordValidationError(pw: string): string | null {
  if (pw.length < 12) return PASSWORD_VALIDATION_MESSAGES.minLength;
  if (!/[a-zA-Z]/.test(pw)) return PASSWORD_VALIDATION_MESSAGES.mustIncludeLetters;
  if (!/[A-Z]/.test(pw)) return PASSWORD_VALIDATION_MESSAGES.mustIncludeUppercase;
  if (!/\d/.test(pw)) return PASSWORD_VALIDATION_MESSAGES.mustIncludeNumbers;
  if (!/[^a-zA-Z0-9]/.test(pw)) return PASSWORD_VALIDATION_MESSAGES.mustIncludeSpecialChar;
  return null;
}

function showErrorToast(title: string, description: string) {
  toast({ title, description, variant: "destructive" });
}

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setIsLoading(true);

  const { password, confirmPassword } = formData;

  const validationError = getPasswordValidationError(password);
  if (validationError) {
    showErrorToast("Invalid Password", validationError);
    return setIsLoading(false);
  }

  if (password !== confirmPassword) {
    showErrorToast("Error", "Passwords do not match");
    return setIsLoading(false);
  }

  if (!recaptchaToken) {
    showErrorToast("reCAPTCHA Error", "Please verify you are not a robot");
    return setIsLoading(false);
  }

  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.fullName,
        email: formData.email,
        password,
        jobTitle: formData.jobTitle,
        department: formData.department,
        workDomain: formData.workDomain,
        organization: formData.organization,
        recaptchaToken,
      }),
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data.message || "Failed to register");

    toast({ title: "Success", description: "Account created successfully!" });
    router.push("/login");
  } catch (error: any) {
    showErrorToast("Error", error.message || "Something went wrong. Please try again.");
  } finally {
    setIsLoading(false);
  }
};

  return (
    <Card className="w-full">
      <form onSubmit={handleSubmit}>
        <CardContent className="pt-6 space-y-4">
          {/* FullName, Email, Password, Confirm Password */}
          {["fullName", "email", "password", "confirmPassword", "organization"].map((field) => (
            <div className="space-y-2" key={field}>
              <Label htmlFor={field}>
                {(() => {
                  if (field === "confirmPassword") return "Confirm Password"
                  if (field === "fullName") return "Full Name"
                  return field.charAt(0).toUpperCase() + field.slice(1)
                })()}
              </Label>
              <Input
                id={field}
                type={field.toLowerCase().includes("password") ? "password" : "text"}
                required
                autoComplete={field}
                value={formData[field as keyof typeof formData]}
                onChange={handleChange}
              />
            </div>
          ))}

          {/* Select Dropdowns */}
          {["jobTitle", "department", "workDomain"].map((field) => (
            <div className="space-y-2" key={field}>
              <Label htmlFor={field}>{field.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}</Label>
              <Select onValueChange={(value) => handleSelectChange(field, value)}>
                <SelectTrigger id={field}>
                  <SelectValue placeholder={`Select your ${field}`} />
                </SelectTrigger>
                <SelectContent>
                    {(() => {
                    let options: string[] = [];
                    if (field === "jobTitle") {
                      options = ["Manager", "Director", "Analyst", "Specialist", "Coordinator", "Consultant", "Other"];
                    } else if (field === "department") {
                      options = ["Operations", "Supply Chain", "Procurement", "Logistics", "Finance", "IT", "Other"];
                    } else {
                      options = ["Healthcare", "Pharmaceuticals", "Manufacturing", "Retail", "Logistics", "Government", "Education", "Other"];
                    }
                    return options.map((option) => (
                      <SelectItem key={option} value={option.toLowerCase().replace(" ", "_")}>
                      {option}
                      </SelectItem>
                    ));
                    })()}
                </SelectContent>
              </Select>
            </div>
          ))}

          {/* reCAPTCHA */}
          <div className="mt-4">
            <ReCAPTCHA
              sitekey="6LeB_U0rAAAAAI-paiIFf09I4zhBfg34g_jqJM8K"
              onChange={setRecaptchaToken}
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col">
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating account...
              </>
            ) : (
              "Create Account"
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}
