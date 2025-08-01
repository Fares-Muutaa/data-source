import { NextResponse } from "next/server"
import { db } from "@/lib/db/dbpostgres"
import { twoFactorAuth, users } from "@/lib/db/schema"
import { hashPassword } from "@/lib/auth-utils"
import { eq } from "drizzle-orm"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, password, jobTitle, department, workDomain, organization, recaptchaToken } = body

    // 1. Check reCAPTCHA token
    if (!recaptchaToken) {
      return NextResponse.json({ message: "Missing reCAPTCHA token" }, { status: 400 })
    }

    const recaptchaRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`,
    })

    const recaptchaData = await recaptchaRes.json()

    if (!recaptchaData.success) {
      return NextResponse.json({ message: "reCAPTCHA verification failed" }, { status: 400 })
    }

    // 2. Validate required fields
    if (!name || !email || !password) {
      return NextResponse.json({ message: "Name, email, and password are required" }, { status: 400 })
    }

    // 3. Check if user already exists
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, email))

    if (existing.length > 0) {
      return NextResponse.json({ message: "User with this email already exists" }, { status: 409 })
    }

    // 4. Hash password
    const hashedPassword = await hashPassword(password)

    // 5. Create user
    const newUser = await db
      .insert(users)
      .values({
        name,
        email,
        password: hashedPassword,
        jobTitle,
        department,
        workDomain,
        organization,
        passwordupdatedat: new Date(),
        isDisabled: false,
      })
      .returning({ id: users.id })

    if (!newUser[0]?.id) {
      return NextResponse.json({ message: "Failed to create user" }, { status: 500 })
    }

    // 6. Init 2FA defaults
    await db.insert(twoFactorAuth).values({
      userId: newUser[0].id,
      isTwoFactorEnabled: false,
      totpSecret: null,
    })

    return NextResponse.json(
      { message: "User registered successfully", userId: newUser[0].id },
      { status: 201 }
    )
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json({ message: "An error occurred during registration" }, { status: 500 })
  }
}
