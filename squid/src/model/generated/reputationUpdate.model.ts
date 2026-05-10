import {Entity as Entity_, Column as Column_, PrimaryColumn as PrimaryColumn_} from "typeorm"
import * as marshal from "./marshal"

@Entity_()
export class ReputationUpdate {
    constructor(props?: Partial<ReputationUpdate>) {
        Object.assign(this, props)
    }

    @PrimaryColumn_()
    id!: string

    @Column_("text", {nullable: false})
    user!: string

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    delta!: bigint

    @Column_("numeric", {transformer: marshal.bigintTransformer, nullable: false})
    newScore!: bigint

    @Column_("text", {nullable: false})
    challenge!: string

    @Column_("timestamp with time zone", {nullable: false})
    timestamp!: Date
}
