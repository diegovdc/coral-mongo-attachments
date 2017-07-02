'use strict'
const expect = require("chai").expect
const R = require('ramda')
const Task = require('data.task')
const mongoAttachments = require('../mongo-attachments')


describe('MongoAttachments', function() {

	describe('processAttachmentsAndBody', () => {
		it('returns the attachments arrays as part of the body using Mongo`s $addToSet syntax, and if there are aditional fields to be created or updated, and object with Mongo\'s $set syntax is also returned', () => {
			
			let req_with_attachments_and_extras = {
				body: {
					name: 'bla',
					images: ['000perro.jpg']
				}
			}
			
			let req_with_attachments = {
				body: {
					images: ['000perro.jpg']
				}
			}

			let req_with_extras = {
				body: {
					name: 'bla',
				}
			}
			
			let separate1 = mongoAttachments.processAttachmentsAndBody(
				mongoAttachments.processor('http://localhost:1231/public/uploads', {}),
				{images: ['images']}, 
				req_with_attachments_and_extras
			)

			let separate2 = mongoAttachments.processAttachmentsAndBody(
				mongoAttachments.processor('http://localhost:1231/public/uploads', {}),
				{images: ['images']}, 
				req_with_attachments
			)

			let separate3 = mongoAttachments.processAttachmentsAndBody(
				mongoAttachments.processor('http://localhost:1231/public/uploads', {}),
				{images: ['images']}, 
				req_with_extras
			)

			
			expect(separate1).to.eql({
									$set: {
										name:'bla',
										'attachments.images': [{
											image_id: '000perro.jpg',
											order: 0,
											thumbnail_url: "http://localhost:1231/public/uploads/thumbnails/000perro.jpg",
											url: "http://localhost:1231/public/uploads/000perro.jpg"
										}]
									}
								})

			expect(separate2).to.eql({
									$set: {
										'attachments.images': [{
											image_id: '000perro.jpg',
											order: 0,
											thumbnail_url: "http://localhost:1231/public/uploads/thumbnails/000perro.jpg",
											url: "http://localhost:1231/public/uploads/000perro.jpg"
										}]
									}
								})

			expect(separate3).to.eql({
									$set: {
										name:'bla',
									}
								})
		});
	});

	describe('processZippedAttachmentsAndBody:: [String] -> {attachment_name: [String]} -> {$addToSet {attachment_name}}, $set{}} || {$addToSet {attachment_name}} || $set{}}', () => {
		
		it('[zipManyWith], Zips an array of arrays with the given function', () => {
			let arr = [[{first: 'Diego'}, {first: 'Gaby'}], [{last: 'Villasenor'}, {last: 'Ocadiz'},  {last: 'Perez'}], [{music: 'experimental'}, {music: 'crazy'}]]
			let merged = mongoAttachments.zipManyWith(R.mergeAll, arr)
			expect(merged).to.eql([
				{first: 'Diego', last: 'Villasenor', music:'experimental'},
				{first: 'Gaby', last: 'Ocadiz', music: 'crazy'},
			])
		})
		
		it('[zipManyWith], also works on strings', () => {
			let arr = [['a', 'a', 'a'], ['b', 'b', 'b'], ['c', 'c', 'c']]
			let output = [['a','b', 'c'], ['a','b', 'c'], ['a','b', 'c']]
			
			// R.identity :: (x=> x)
			let concated = mongoAttachments.zipManyWith(R.identity,  arr )
			
			expect(concated).to.eql(output)

		})

		it('recives an attachments array, a to_zip array of arrays and request body, and does the same as processZippedAttachmentsAndBody except that it merges the to_zip elements in one object before calling the updateOneTask.', () => {
			let req = {
				body: {
					images: ['000perro.jpg', '000gato.jpg'],
					description: ['es un perro', 'es un gato']
				}
			}
			let zipped = mongoAttachments.processZippedAttachmentsAndBody(
					mongoAttachments.processor('http://localhost:1231/public/uploads', {}),
					{images: ['images'], description: ['description']}, 
					{mis_images: ['images', 'description']}, 
					req
			)

			expect(zipped).to.eql({
									$set: {
										'attachments.mis_images': [{
												image_id: '000perro.jpg',
												order: 0,
												thumbnail_url: "http://localhost:1231/public/uploads/thumbnails/000perro.jpg",
												url: "http://localhost:1231/public/uploads/000perro.jpg",
												description: 'es un perro'
											},
											{
												image_id: '000gato.jpg',
												order: 1,
												thumbnail_url: "http://localhost:1231/public/uploads/thumbnails/000gato.jpg",
												url: "http://localhost:1231/public/uploads/000gato.jpg",
												description: 'es un gato'
											},
											]
										}
								})

		});
		it('puts non-attachment fields in the request in their own properties', () => {
			let req = {
				body: {
					images: ['000perro.jpg', '000gato.jpg'],
					description: ['es un perro', 'es un gato'],
					title: 'mis images'
				}
			}
			let zipped = mongoAttachments.processZippedAttachmentsAndBody(
					mongoAttachments.processor('http://localhost:1231/public/uploads', {}),
					{images: ['images'], description: ['description']}, 
					{mis_images: ['images', 'description']}, 
					req
			)

			expect(zipped).to.eql({
				$set: {
					title: 'mis images',
					'attachments.mis_images': [
					{
						image_id: '000perro.jpg',
						order: 0,
						thumbnail_url: "http://localhost:1231/public/uploads/thumbnails/000perro.jpg",
						url: "http://localhost:1231/public/uploads/000perro.jpg",
						description: 'es un perro'
					},
					{
						image_id: '000gato.jpg',
						order: 1,
						thumbnail_url: "http://localhost:1231/public/uploads/thumbnails/000gato.jpg",
						url: "http://localhost:1231/public/uploads/000gato.jpg",
						description: 'es un gato'
					},
					]
				}
			})
		});

		it('does note care if it receives fields with nested stuff', () => {
			let req = {
				body: {
					images: ['000perro.jpg', '000gato.jpg'],
					description: ['es un perro', 'es un gato'],
					title: 'mis images',
					address: {
						street1:'a',
						street2:'b'
					}
				}
			}
			let zipped = mongoAttachments.processZippedAttachmentsAndBody(
					mongoAttachments.processor('http://localhost:1231/public/uploads', {}),
					{images: ['images'], description: ['description']}, 
					{mis_images: ['images', 'description']}, 
					req
			)

			expect(zipped).to.eql({
				$set: {
					title: 'mis images',
					address: {
						street1:'a',
						street2:'b'
					},
					'attachments.mis_images': [
					{
						image_id: '000perro.jpg',
						order: 0,
						thumbnail_url: "http://localhost:1231/public/uploads/thumbnails/000perro.jpg",
						url: "http://localhost:1231/public/uploads/000perro.jpg",
						description: 'es un perro'
					},
					{
						image_id: '000gato.jpg',
						order: 1,
						thumbnail_url: "http://localhost:1231/public/uploads/thumbnails/000gato.jpg",
						url: "http://localhost:1231/public/uploads/000gato.jpg",
						description: 'es un gato'
					},
					]
				}
			})
		});

		it('truncates the zipped collection to the smallest', () => {
			let req = {
				body: {
					images: ['000perro.jpg', '000gato.jpg'],
					description: ['es un perro', 'es un gato', 'es un lagarto'],
					title: 'mis images'
				}
			}

			let zipped = mongoAttachments.processZippedAttachmentsAndBody(
					mongoAttachments.processor('http://localhost:1231/public/uploads', {}),
					{images: ['images'], description: ['description']}, 
					{mis_images: ['images', 'description']}, 
					req
			)

			expect(zipped).to.eql({
				$set: {
					title: 'mis images',
					'attachments.mis_images': [
					{
						image_id: '000perro.jpg',
						order: 0,
						thumbnail_url: "http://localhost:1231/public/uploads/thumbnails/000perro.jpg",
						url: "http://localhost:1231/public/uploads/000perro.jpg",
						description: 'es un perro'
					},
					{
						image_id: '000gato.jpg',
						order: 1,
						thumbnail_url: "http://localhost:1231/public/uploads/thumbnails/000gato.jpg",
						url: "http://localhost:1231/public/uploads/000gato.jpg",
						description: 'es un gato'
					},
					]
				}
			})
		});

		it('returns a slightly different object if an image field -in the array- is empty', () => {
			let req = {
				body: {
					images: ['000perro.jpg', '000gato.jpg', ''],
					description: ['es un perro', 'es un gato', 'es un lagarto'],
					title: 'mis images'
				}
			}
			
			let zipped = mongoAttachments.processZippedAttachmentsAndBody(
					mongoAttachments.processor('http://localhost:1231/public/uploads', {}),
					{images: ['images'], description: ['description']}, 
					{mis_images: ['images', 'description']}, 
					req
			)

			expect(zipped).to.eql({
				$set: {
					title: 'mis images',
					'attachments.mis_images': [
					{
						image_id: '000perro.jpg',
						order: 0,
						thumbnail_url: "http://localhost:1231/public/uploads/thumbnails/000perro.jpg",
						url: "http://localhost:1231/public/uploads/000perro.jpg",
						description: 'es un perro'
					},
					{
						image_id: '000gato.jpg',
						order: 1,
						thumbnail_url: "http://localhost:1231/public/uploads/thumbnails/000gato.jpg",
						url: "http://localhost:1231/public/uploads/000gato.jpg",
						description: 'es un gato'
					},
					{
						image_id: '',
						order: 2,
						thumbnail_url: "",
						url: "",
						description: 'es un lagarto'
					},
					]
				}
			})
		});
	})

});
