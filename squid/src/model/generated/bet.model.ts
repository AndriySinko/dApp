import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, ManyToOne as ManyToOne_, Index as Index_} from "typeorm"
import * as marshal from "./marshal"
import {Challenge} from "./challenge.model"

@Entity_()
export class Bet {
    constructor(props?: Partial<Bet>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Index_()
    @ManyToOne_(() => Challenge, {nullable: true})
    challenge!: Challenge

    @Column_("text", {nullable: false})
    bettor!: string

    @Column_("bool", {nullable: false})
    side!: boolean

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    amount!: bigint

    @Column_("timestamp with time zone", {nullable: false})
    timestamp!: Date

    @Column_("text", {nullable: false})
    txHash!: string
}
