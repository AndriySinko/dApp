module.exports = class Data1706000000000 {
    name = 'Data1706000000000'

    async up(db) {
        // challenge — core entity, must be created first (others FK into it)
        await db.query(`CREATE TABLE "challenge" (
            "id" character varying NOT NULL,
            "challenge_id" numeric NOT NULL,
            "type" character varying(10) NOT NULL,
            "verifier" character varying(10) NOT NULL,
            "state" character varying(14) NOT NULL,
            "creator" text NOT NULL,
            "title" text NOT NULL,
            "criteria" text NOT NULL,
            "buy_in" numeric NOT NULL,
            "join_deadline" numeric NOT NULL,
            "challenge_deadline" numeric NOT NULL,
            "created_at" TIMESTAMP WITH TIME ZONE NOT NULL,
            "created_tx_hash" text NOT NULL,
            "for_pool" numeric,
            "against_pool" numeric,
            "bettors_for" integer,
            "bettors_against" integer,
            CONSTRAINT "PK_challenge" PRIMARY KEY ("id")
        )`)

        await db.query(`CREATE TABLE "bet" (
            "id" character varying NOT NULL,
            "bettor" text NOT NULL,
            "side" boolean NOT NULL,
            "amount" numeric NOT NULL,
            "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL,
            "tx_hash" text NOT NULL,
            "challenge_id" character varying,
            CONSTRAINT "PK_bet" PRIMARY KEY ("id")
        )`)

        await db.query(`CREATE INDEX "IDX_bet_challenge_id" ON "bet" ("challenge_id")`)

        await db.query(`CREATE TABLE "participant" (
            "id" character varying NOT NULL,
            "participant" text NOT NULL,
            "stake" numeric NOT NULL,
            "joined_at" TIMESTAMP WITH TIME ZONE NOT NULL,
            "verdict" boolean,
            "payout" numeric,
            "pnl" numeric,
            "challenge_id" character varying,
            CONSTRAINT "PK_participant" PRIMARY KEY ("id")
        )`)

        await db.query(`CREATE INDEX "IDX_participant_challenge_id" ON "participant" ("challenge_id")`)

        await db.query(`CREATE TABLE "reputation_update" (
            "id" character varying NOT NULL,
            "user" text NOT NULL,
            "delta" numeric NOT NULL,
            "new_score" numeric NOT NULL,
            "challenge" text NOT NULL,
            "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL,
            CONSTRAINT "PK_reputation_update" PRIMARY KEY ("id")
        )`)

        await db.query(`CREATE TABLE "user_reputation" (
            "id" character varying NOT NULL,
            "score" numeric NOT NULL,
            "last_updated" TIMESTAMP WITH TIME ZONE NOT NULL,
            CONSTRAINT "PK_user_reputation" PRIMARY KEY ("id")
        )`)

        await db.query(`CREATE TABLE "epoch_result" (
            "id" character varying NOT NULL,
            "epoch" numeric NOT NULL,
            "winning_title" text NOT NULL,
            "public_challenge_address" text NOT NULL,
            "prize_pool" numeric NOT NULL,
            "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL,
            CONSTRAINT "PK_epoch_result" PRIMARY KEY ("id")
        )`)

        await db.query(`CREATE TABLE "factory_activity" (
            "id" character varying NOT NULL,
            "user" text NOT NULL,
            "challenge" text NOT NULL,
            "activity_type" text NOT NULL,
            "amount" numeric NOT NULL,
            "timestamp" TIMESTAMP WITH TIME ZONE NOT NULL,
            "tx_hash" text NOT NULL,
            CONSTRAINT "PK_factory_activity" PRIMARY KEY ("id")
        )`)

        await db.query(`ALTER TABLE "bet" ADD CONSTRAINT "FK_bet_challenge_id" FOREIGN KEY ("challenge_id") REFERENCES "challenge"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`)
        await db.query(`ALTER TABLE "participant" ADD CONSTRAINT "FK_participant_challenge_id" FOREIGN KEY ("challenge_id") REFERENCES "challenge"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`)
    }

    async down(db) {
        await db.query(`ALTER TABLE "participant" DROP CONSTRAINT "FK_participant_challenge_id"`)
        await db.query(`ALTER TABLE "bet" DROP CONSTRAINT "FK_bet_challenge_id"`)
        await db.query(`DROP TABLE "factory_activity"`)
        await db.query(`DROP TABLE "epoch_result"`)
        await db.query(`DROP TABLE "user_reputation"`)
        await db.query(`DROP TABLE "reputation_update"`)
        await db.query(`DROP INDEX "IDX_participant_challenge_id"`)
        await db.query(`DROP TABLE "participant"`)
        await db.query(`DROP INDEX "IDX_bet_challenge_id"`)
        await db.query(`DROP TABLE "bet"`)
        await db.query(`DROP TABLE "challenge"`)
    }
}
