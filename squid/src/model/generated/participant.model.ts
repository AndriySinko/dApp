import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_} from "typeorm"
import * as marshal from "./marshal"
import {Challenge} from "./challenge.model"

@Entity_()
export class Participant {
    constructor(props?: Partial<Participant>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => Challenge, {nullable: true})
    challenge!: Challenge

    @Column_("text", {nullable: false})
    participant!: string

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    stake!: bigint

    @Column_("timestamp with time zone", {nullable: false})
    joinedAt!: Date

    @Column_("bool", {nullable: true})
    verdict!: boolean | undefined | null

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: true})
    payout!: bigint | undefined | null

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: true})
    pnl!: bigint | undefined | null
}
