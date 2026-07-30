import type { NextFunction } from "express";
import type { Response } from "express";
import type { Request } from "express";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "../../packages/db/index.ts";

const supabaseUrl = process.env.SUPABASE_URL ?? "https://vqjtztoejtjlavueomdh.supabase.co";

export function isSupabaseConfigured() {
    return Boolean(process.env.SUPABASE_SECRET_KEY);
}

export function getSupabaseClient() {
    const secretKey = process.env.SUPABASE_SECRET_KEY;

    if (!secretKey) {
        return null;
    }

    return createClient(supabaseUrl, secretKey);
}

export async function middleware(req: Request, res: Response, next: NextFunction) {
    console.log("Authorization Header:", req.headers.authorization);

    const token = req.headers.authorization;

    if (!token) {
        console.log("No token received");
        return res.status(401).json({
            message: "No token received"
        });
    }

    const supabase = getSupabaseClient();

    if (!supabase) {
        console.log("Supabase auth is not configured; rejecting protected request.");
        return res.status(401).json({
            message: "Authentication unavailable"
        });
    }

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);

        console.log("User:", user);
        console.log("Error:", error);

        const address = user?.user_metadata?.custom_claims?.address;

        if (!address) {
            return res.status(403).json({
                message: "Incorrect Credentials"
            });
        }

        const userDb = await prisma.user.upsert({
            where: {
                address,
            },
            update: {
                address,
            },
            create: {
                address,
                usdBalance: 0,
            }
        });

        (req as Request & { userId?: string }).userId = userDb.id;
        next();
    } catch (e) {
        console.log(e);
        res.status(403).json({
            message: "Incorrect Credentials"
        });
    }
}