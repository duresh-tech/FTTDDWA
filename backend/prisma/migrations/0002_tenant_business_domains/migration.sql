-- CreateTable
CREATE TABLE "tenant_business_domains" (
    "id" CHAR(36) NOT NULL,
    "tenantBusinessId" CHAR(36) NOT NULL,
    "hostname" VARCHAR(253) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdBySystemUserId" CHAR(36),
    "createdAt" BIGINT NOT NULL,
    "updatedAt" BIGINT NOT NULL,

    CONSTRAINT "tenant_business_domains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_business_domains_hostname_key" ON "tenant_business_domains"("hostname");

-- CreateIndex
CREATE INDEX "tenant_business_domains_tenantBusinessId_idx" ON "tenant_business_domains"("tenantBusinessId");

-- AddForeignKey
ALTER TABLE "tenant_business_domains" ADD CONSTRAINT "tenant_business_domains_tenantBusinessId_fkey" FOREIGN KEY ("tenantBusinessId") REFERENCES "tenant_business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

