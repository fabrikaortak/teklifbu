import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  getSellerPublicProfile,
  listSellerCompletedListings,
  listSellerPublicListings,
} from "@/core/services/sellerProfileService";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "Satıcı gerekli" }, { status: 400 });

  const session = await getSession();
  const profile = await getSellerPublicProfile(id, { viewerId: session?.id || null });
  if (!profile.ok) {
    return NextResponse.json(
      { error: profile.error, ...(profile.code ? { code: profile.code } : {}) },
      { status: profile.status }
    );
  }

  const [listings, completedListings] = await Promise.all([
    listSellerPublicListings(id),
    listSellerCompletedListings(id),
  ]);

  return NextResponse.json({
    seller: profile.seller,
    isSellerFavorited: profile.isSellerFavorited,
    isOwnProfile: profile.isOwnProfile,
    reviewsEnabled: profile.reviewsEnabled,
    reviews: profile.reviews,
    gallery: profile.gallery,
    achievements: profile.achievements,
    listings,
    completedListings,
  });
}
