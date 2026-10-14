ALTER TABLE `videoProcessingJobs` MODIFY COLUMN `status` enum('pending','processing','ready','failed','cancelled') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `videoProcessingJobs` ADD `stage` varchar(48) DEFAULT 'queued' NOT NULL;--> statement-breakpoint
ALTER TABLE `videoProcessingJobs` ADD `stageStartedAt` timestamp;--> statement-breakpoint
ALTER TABLE `videoProcessingJobs` ADD `processingStartedAt` timestamp;--> statement-breakpoint
ALTER TABLE `videoProcessingJobs` ADD `progressPercent` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `videoProcessingJobs` ADD `originalSizeBytes` int;--> statement-breakpoint
ALTER TABLE `videoProcessingJobs` ADD `processedSizeBytes` int;--> statement-breakpoint
ALTER TABLE `videoProcessingJobs` ADD `sourceDurationSeconds` int;--> statement-breakpoint
ALTER TABLE `videoProcessingJobs` ADD `processingLog` text;