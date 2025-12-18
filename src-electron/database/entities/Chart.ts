import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity()
export class Chart {
	@PrimaryGeneratedColumn('uuid')
	id: string

	@Column()
	md5: string

	@Column()
	hasVideoBackground: boolean

	@Column()
	charter: string

	@Column()
	name: string

	@Column()
	artist: string

	@Column()
	album: string

	@Column()
	genre: string

	@Column()
	year: string
}
