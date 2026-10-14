CREATE TABLE `categories` (
	`id` varchar(32) NOT NULL,
	`name` varchar(64) NOT NULL,
	`color` varchar(7) NOT NULL,
	`sortOrder` int NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `collectionItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`collectionId` int NOT NULL,
	`reactionId` int NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `collectionItems_id` PRIMARY KEY(`id`),
	CONSTRAINT `collection_reaction_unique` UNIQUE(`collectionId`,`reactionId`)
);
--> statement-breakpoint
CREATE TABLE `collections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(96) NOT NULL,
	`title` varchar(160) NOT NULL,
	`description` text,
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`sortOrder` int NOT NULL DEFAULT 0,
	`isTestData` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `collections_id` PRIMARY KEY(`id`),
	CONSTRAINT `collections_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `failedSearchQueries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`normalizedQuery` varchar(255) NOT NULL,
	`originalQuery` varchar(255) NOT NULL,
	`occurrences` int NOT NULL DEFAULT 1,
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `failedSearchQueries_id` PRIMARY KEY(`id`),
	CONSTRAINT `failedSearchQueries_normalizedQuery_unique` UNIQUE(`normalizedQuery`)
);
--> statement-breakpoint
CREATE TABLE `reactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`publicId` varchar(32) NOT NULL,
	`categoryId` varchar(32) NOT NULL,
	`status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`quote` varchar(180) NOT NULL,
	`situation` varchar(255) NOT NULL,
	`description` text,
	`keywords` text,
	`durationSeconds` int NOT NULL,
	`corner` enum('tr','tl') NOT NULL DEFAULT 'tr',
	`sourceName` varchar(255),
	`sourceUrl` varchar(2048),
	`rightsStatus` enum('pending','cleared','permission','original','restricted') NOT NULL DEFAULT 'pending',
	`isTestData` boolean NOT NULL DEFAULT true,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `reactions_publicId_unique` UNIQUE(`publicId`)
);
--> statement-breakpoint
ALTER TABLE `collectionItems` ADD CONSTRAINT `collectionItems_collectionId_collections_id_fk` FOREIGN KEY (`collectionId`) REFERENCES `collections`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `collectionItems` ADD CONSTRAINT `collectionItems_reactionId_reactions_id_fk` FOREIGN KEY (`reactionId`) REFERENCES `reactions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reactions` ADD CONSTRAINT `reactions_categoryId_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `collection_items_position_idx` ON `collectionItems` (`collectionId`,`position`);--> statement-breakpoint
CREATE INDEX `collections_status_idx` ON `collections` (`status`,`sortOrder`);--> statement-breakpoint
CREATE INDEX `failed_search_occurrences_idx` ON `failedSearchQueries` (`occurrences`);--> statement-breakpoint
CREATE INDEX `reactions_status_idx` ON `reactions` (`status`);--> statement-breakpoint
CREATE INDEX `reactions_category_status_idx` ON `reactions` (`categoryId`,`status`);