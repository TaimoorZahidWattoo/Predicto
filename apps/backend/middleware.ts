import type { NextFunction } from "express";
import type { Response } from "express";
import type { Request } from "express";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "db";

const supabase = createClient("https://vqjtztoejtjlavueomdh.supabase.co", process.env.SUPABASE_SECRET_KEY!);
export async function middleware(req: Request, res: Response, next: NextFunction) {

    console.log("Authorization Header:", req.headers.authorization);

    const token = req.headers.authorization;

    if (!token) {
        console.log("No token received");
        return res.status(401).json({
            message: "No token received"
        });
    }

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);

        console.log("User:", user);
        console.log("Error:", error);

        const address: string = user?.user_metadata.custom_claims.address;

        const userDb =await prisma.user.upsert({
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

        if (address) {
            req.userId = userDb.id;
            next();
        } else {
            res.status(403).json({
                message: "Incorrect Credentials"
            });
        }

    } catch (e) {
        console.log(e);
        res.status(403).json({
            message: "Incorrect Credentials"
        });
    }
}
// export async function middleware(req: Request, res: Response, next: NextFunction) {
//     const token = req.headers.authorization;
// try {
//     const { data: { user } , error } = await supabase.auth.getUser(token);
//     const address = user?.user_metadata.custom_claims.address;
//     if(address){
//         req.userId = address;
//         next();
//     } else {
//         res.status(403).json({ message: "Incorrect Credentials" });

//     }
//     console.log(user);
//     console.log(error);
    
// } catch (e) {
//     res.status(403).json({ message: "Incorrect Credentials" });
// }
    
// }