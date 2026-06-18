import { getOptionalEnv } from "@/lib/config";
import type { AppRepositories, RepositoryProvider } from "@/lib/repositories/contracts";
import { createMockRepositories } from "@/lib/repositories/mock-repositories";
import { createPrismaRepositories } from "@/lib/repositories/prisma-repositories";

export function getRepositoryProvider(): RepositoryProvider {
  return getOptionalEnv("REPOSITORY_PROVIDER") === "prisma" ? "prisma" : "mock";
}

export function createRepositories(provider = getRepositoryProvider()): AppRepositories {
  if (provider === "prisma") {
    return createPrismaRepositories();
  }

  return createMockRepositories();
}

export const repositories = createRepositories();
