import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_, OneToMany as OneToMany_} from "typeorm"
import * as marshal from "./marshal"
import {ChallengeType} from "./_challengeType"
import {VerifierType} from "./_verifierType"
import {ChallengeState} from "./_challengeState"
import {Bet} from "./bet.model"
import {Participant} from "./participant.model"

@Entity_()
export class Challenge {
    constructor(props?: Partial<Challenge>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    challengeId!: bigint

    @Column_("varchar", {length: 10, nullable: false})
    type!: ChallengeType

    @Column_("varchar", {length: 10, nullable: false})
    verifier!: VerifierType

    @Column_("varchar", {length: 14, nullable: false})
    state!: ChallengeState

    @Column_("text", {nullable: false})
    creator!: string

    @Column_("text", {nullable: false})
    title!: string

    @Column_("text", {nullable: false})
    criteria!: string

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    buyIn!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    joinDeadline!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    challengeDeadline!: bigint

    @Column_("timestamp with time zone", {nullable: false})
    createdAt!: Date

    @Column_("text", {nullable: false})
    createdTxHash!: string

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: true})
    forPool!: bigint | undefined | null

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: true})
    againstPool!: bigint | undefined | null

    @Column_("int4", {nullable: true})
    bettorsFor!: number | undefined | null

    @Column_("int4", {nullable: true})
    bettorsAgainst!: number | undefined | null

    @OneToMany_(() => Bet, e => e.challenge)
    bets!: Bet[]

    @OneToMany_(() => Participant, e => e.challenge)
    participants!: Participant[]
}
