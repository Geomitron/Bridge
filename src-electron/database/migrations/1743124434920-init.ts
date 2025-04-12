import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1743124434920 implements MigrationInterface {
    name = 'Init1743124434920'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "chart" ("id" varchar PRIMARY KEY NOT NULL, "md5" varchar NOT NULL, "hasVideoBackground" boolean NOT NULL, "charter" varchar NOT NULL, "name" varchar NOT NULL, "artist" varchar NOT NULL, "album" varchar NOT NULL, "genre" varchar NOT NULL, "year" varchar NOT NULL)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "chart"`);
    }

}
