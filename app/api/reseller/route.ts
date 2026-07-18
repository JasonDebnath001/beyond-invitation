import { NextResponse, type NextRequest } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import {
    createReseller,
    getResellerByClerkId,
    updateResellerMargin,
    clampMargin,
    RESELLER_MAX_MARGIN,
    RESELLER_URL_PARAM,
} from "@/lib/reseller";
import { getSiteUrl } from "@/lib/site-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function publicProfile(reseller: {
    code: string;
    resellerName: string;
    email: string;
    phone: string;
    marginPercent: number;
    active: boolean;
}) {
    return {
        code: reseller.code,
        resellerName: reseller.resellerName,
        email: reseller.email,
        phone: reseller.phone,
        marginPercent: reseller.marginPercent,
        active: reseller.active,
        maxMarginPercent: RESELLER_MAX_MARGIN,
        urlParam: RESELLER_URL_PARAM,
        siteUrl: getSiteUrl(),
    };
}

export async function GET() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Please sign in." }, { status: 401 });
        }

        const reseller = await getResellerByClerkId(userId);
        if (!reseller) {
            return NextResponse.json({ registered: false });
        }

        return NextResponse.json({
            registered: true,
            profile: publicProfile(reseller),
        });
    } catch (error) {
        console.error("Reseller GET error:", error);
        return NextResponse.json(
            { error: "Unable to load reseller profile." },
            { status: 500 },
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Please sign in." }, { status: 401 });
        }

        const existing = await getResellerByClerkId(userId);
        if (existing) {
            return NextResponse.json(
                { error: "You already have a reseller account." },
                { status: 409 },
            );
        }

        const user = await currentUser();
        const email =
            user?.primaryEmailAddress?.emailAddress ??
            user?.emailAddresses?.[0]?.emailAddress ??
            "";

        const body = await request.json().catch(() => ({}));

        const resellerName =
            typeof body?.resellerName === "string" ? body.resellerName.trim() : "";
        const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
        const marginPercent = clampMargin(Number(body?.marginPercent));

        if (!resellerName) {
            return NextResponse.json(
                { error: "Business / reseller name is required." },
                { status: 400 },
            );
        }
        if (!email) {
            return NextResponse.json(
                { error: "Your account has no email address." },
                { status: 400 },
            );
        }

        const reseller = await createReseller({
            clerkUserId: userId,
            resellerName,
            email,
            phone,
            marginPercent,
        });

        return NextResponse.json({
            registered: true,
            profile: publicProfile(reseller),
        });
    } catch (error) {
        console.error("Reseller POST error:", error);
        return NextResponse.json(
            { error: "Unable to create reseller account." },
            { status: 500 },
        );
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: "Please sign in." }, { status: 401 });
        }

        const reseller = await getResellerByClerkId(userId);
        if (!reseller) {
            return NextResponse.json(
                { error: "No reseller account found." },
                { status: 404 },
            );
        }

        const body = await request.json().catch(() => ({}));
        const requested = Number(body?.marginPercent);

        if (!Number.isFinite(requested) || requested < 0) {
            return NextResponse.json(
                { error: "Margin must be a number of 0 or more." },
                { status: 400 },
            );
        }

        const marginPercent = await updateResellerMargin(
            reseller.docName,
            requested,
        );

        return NextResponse.json({
            registered: true,
            profile: publicProfile({ ...reseller, marginPercent }),
        });
    } catch (error) {
        console.error("Reseller PATCH error:", error);
        return NextResponse.json(
            { error: "Unable to update margin." },
            { status: 500 },
        );
    }
}