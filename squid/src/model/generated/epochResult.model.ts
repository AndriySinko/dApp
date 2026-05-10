import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_} from "typeorm"
import * as marshal from "./marshal"

@Entity_()
export class EpochResult {
    constructor(props?: Partial<EpochResult>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    epoch!: bigint

    @Column_("text", {nullable: false})
    winningTitle!: string

    @Column_("text", {nullable: false})
    publicChallengeAddress!: string

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    prizePool!: bigint

    @Column_("timestamp with time zone", {nullable: false})
    timestamp!: Date
}
