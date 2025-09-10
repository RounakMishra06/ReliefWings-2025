-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('ADMIN', 'OPERATOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "public"."DroneStatus" AS ENUM ('ONLINE', 'OFFLINE', 'MAINTENANCE', 'ERROR');

-- CreateEnum
CREATE TYPE "public"."CommandStatus" AS ENUM ('PENDING', 'EXECUTING', 'COMPLETED', 'FAILED', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "public"."MissionStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED', 'ABORTED', 'PAUSED');

-- CreateEnum
CREATE TYPE "public"."AlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL DEFAULT 'VIEWER',
    "permissions" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."drones" (
    "id" TEXT NOT NULL,
    "drone_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" "public"."DroneStatus" NOT NULL DEFAULT 'OFFLINE',
    "last_seen" TIMESTAMP(3),
    "home_location_lat" DOUBLE PRECISION NOT NULL,
    "home_location_lon" DOUBLE PRECISION NOT NULL,
    "home_location_alt" DOUBLE PRECISION NOT NULL,
    "max_altitude" DOUBLE PRECISION NOT NULL DEFAULT 120,
    "max_speed" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "battery_low_threshold" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."telemetry_data" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'telemetry',
    "version" INTEGER NOT NULL DEFAULT 1,
    "drone_id" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "ts" BIGINT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gps_lat" DOUBLE PRECISION NOT NULL,
    "gps_lon" DOUBLE PRECISION NOT NULL,
    "gps_fix_type" INTEGER NOT NULL,
    "alt_rel" DOUBLE PRECISION NOT NULL,
    "roll" DOUBLE PRECISION NOT NULL,
    "pitch" DOUBLE PRECISION NOT NULL,
    "yaw" DOUBLE PRECISION NOT NULL,
    "vel_x" DOUBLE PRECISION NOT NULL,
    "vel_y" DOUBLE PRECISION NOT NULL,
    "vel_z" DOUBLE PRECISION NOT NULL,
    "battery_voltage" DOUBLE PRECISION NOT NULL,
    "battery_current" DOUBLE PRECISION NOT NULL,
    "battery_remaining" DOUBLE PRECISION NOT NULL,
    "mode" TEXT NOT NULL,
    "armed" BOOLEAN NOT NULL,
    "home_location_lat" DOUBLE PRECISION NOT NULL,
    "home_location_lon" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "telemetry_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."commands" (
    "id" TEXT NOT NULL,
    "drone_id" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'command',
    "command" TEXT NOT NULL,
    "args" JSONB,
    "status" "public"."CommandStatus" NOT NULL DEFAULT 'PENDING',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL DEFAULT 'web',
    "executed_at" TIMESTAMP(3),
    "response" JSONB,
    "error" TEXT,

    CONSTRAINT "commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."missions" (
    "id" TEXT NOT NULL,
    "mission_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "drone_id" TEXT NOT NULL,
    "operator_id" TEXT NOT NULL,
    "status" "public"."MissionStatus" NOT NULL DEFAULT 'PLANNED',
    "waypoints" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "missions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."alerts" (
    "id" TEXT NOT NULL,
    "drone_id" TEXT NOT NULL,
    "severity" "public"."AlertSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "public"."users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "drones_drone_id_key" ON "public"."drones"("drone_id");

-- CreateIndex
CREATE INDEX "telemetry_data_drone_id_ts_idx" ON "public"."telemetry_data"("drone_id", "ts");

-- CreateIndex
CREATE INDEX "telemetry_data_received_at_idx" ON "public"."telemetry_data"("received_at");

-- CreateIndex
CREATE INDEX "telemetry_data_gps_lat_gps_lon_idx" ON "public"."telemetry_data"("gps_lat", "gps_lon");

-- CreateIndex
CREATE INDEX "commands_drone_id_timestamp_idx" ON "public"."commands"("drone_id", "timestamp");

-- CreateIndex
CREATE INDEX "commands_command_timestamp_idx" ON "public"."commands"("command", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "missions_mission_id_key" ON "public"."missions"("mission_id");

-- CreateIndex
CREATE INDEX "missions_mission_id_idx" ON "public"."missions"("mission_id");

-- CreateIndex
CREATE INDEX "missions_drone_id_status_idx" ON "public"."missions"("drone_id", "status");

-- CreateIndex
CREATE INDEX "missions_operator_id_idx" ON "public"."missions"("operator_id");

-- CreateIndex
CREATE INDEX "alerts_drone_id_timestamp_idx" ON "public"."alerts"("drone_id", "timestamp");

-- CreateIndex
CREATE INDEX "alerts_severity_resolved_idx" ON "public"."alerts"("severity", "resolved");

-- AddForeignKey
ALTER TABLE "public"."telemetry_data" ADD CONSTRAINT "telemetry_data_drone_id_fkey" FOREIGN KEY ("drone_id") REFERENCES "public"."drones"("drone_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."commands" ADD CONSTRAINT "commands_drone_id_fkey" FOREIGN KEY ("drone_id") REFERENCES "public"."drones"("drone_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."missions" ADD CONSTRAINT "missions_drone_id_fkey" FOREIGN KEY ("drone_id") REFERENCES "public"."drones"("drone_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."missions" ADD CONSTRAINT "missions_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."alerts" ADD CONSTRAINT "alerts_drone_id_fkey" FOREIGN KEY ("drone_id") REFERENCES "public"."drones"("drone_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."alerts" ADD CONSTRAINT "alerts_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
