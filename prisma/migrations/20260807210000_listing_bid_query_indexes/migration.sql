-- Kritik sorgu index'leri: liste sıralama, vitrin, canlı teklif akışı
CREATE INDEX IF NOT EXISTS "Listing_status_createdAt_idx" ON "Listing"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Listing_status_isFeatured_createdAt_idx" ON "Listing"("status", "isFeatured", "createdAt");
CREATE INDEX IF NOT EXISTS "Listing_isFeatured_featuredUntil_idx" ON "Listing"("isFeatured", "featuredUntil");
CREATE INDEX IF NOT EXISTS "Bid_listingId_createdAt_idx" ON "Bid"("listingId", "createdAt");
CREATE INDEX IF NOT EXISTS "Bid_createdAt_idx" ON "Bid"("createdAt");
