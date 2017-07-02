'use strict'

const R = require('ramda')
const Task = require('data.task')
const {addToSetObjFromArr} = require('coral-mongo-tasks')
const {initInArray, zipManyWith, indexedMap} = require('coral-std-library')

// type Req = {body: {*}}
// type ProcessorFn = (String elem -> index -> {*} )
// type ProcessesObj = {ProcessorFn}
// type ToZipObj = {output_key: ['input_keys_to_zip']}


/**
 * Processes Section: The processor and the default processes
 */

// initProcess :: (String elem -> Int index -> {*}) -> [String elem] -> [{*, order}]
const _initProcess = fn => R.compose(
	indexedMap(fn), //iteramos las propiedades y luego el array asociado a cada propiedad de 'attachmentsObj' (ver process attachments) 
	initInArray)

// _processImage:: (elem -> index) -> {*}
const _processImage = R.curry((uploads_folder, elem, index) => {
	if (elem === '') {
		return {image_id: '', order: index, url: '', thumbnail_url: ''}
	}
	return 	{
		image_id: elem,
		order: index,
		url: uploads_folder+'/'+elem,//el id que mandamos. En la base "id" equivale al "filename" de la Colección "Updates" y "filename" es un campo único, así que podemos aprovechar para construir la url y evitarnos un join/lookup
		thumbnail_url: uploads_folder+'/thumbnails/'+elem
	}
})

//The following two functions may be used to easily register a text field for a property
// makeTextProcess:: prop -> (elem -> index -> {*})
const makeTextProcess = prop => (elem, index) => ({[prop]: elem})
const mtp = makeTextProcess

// processor :: ProcessesObj -> ProcessesObj
// processor :: URL String ->{ (elem -> index -> (String -> {*}) ) } -> { (elem -> index -> (String -> {*}) ) } 
//  The default processes
const processor = R.curry((uploads_folder, processes_obj) => 
	R.merge({
		images: _initProcess(_processImage(uploads_folder)),
		description: _initProcess(mtp('description')),
		title: _initProcess(mtp('title'))
	}, processes_obj)
)



/**
 * The processing of the request into a MongoDb obj with attachments
 */

// _processAttachments :: ProcessesObj -> {type:['attachment_key']} -> {attachment_key: values} -> {'attachments.'+attachment_key: {*}}
const _processAttachments = (processes, attachments_by_type, attachmentsObj) => {
	let attachments_by_group_in_pairs = R.mapObjIndexed((attachments_keys, type_name, obj) => {
		return R.map(key => {
			return ['attachments.'+key, processes[type_name](attachmentsObj[key])]
		}, attachments_keys)
	}, attachments_by_type)
	return R.fromPairs(R.reduce(R.concat, [], R.values(attachments_by_group_in_pairs)))
}

//{output_key: ['input_keys_to_zip']} -> {'attachments.'+input_keys_to_zip: {*}} -> {'attachments.'+output_key: {*}} 
const _zipAttachments = (to_zip_obj, processedAttachments) => {
	let zipped = R.mapObjIndexed((arr, prop, obj) => 
		zipManyWith(R.mergeAll, R.map(attachment_name => processedAttachments['attachments.'+attachment_name], arr)),
		to_zip_obj
	)
	let zippped_pairs = R.toPairs(zipped)
	var headLens = R.lensIndex(0);
	let zipped_as_attachments = R.fromPairs(R.map(R.over(headLens, R.concat('attachments.')), zippped_pairs))
	let zipped_keys= R.compose(R.map(elem => 'attachments.'+elem), R.flatten, R.values)(to_zip_obj)
	let non_zipped_attachments = R.omit(zipped_keys, processedAttachments)
	let zipped_and_non_zipped = R.merge(zipped_as_attachments, non_zipped_attachments)
	return zipped_and_non_zipped
}

// PorcessesObj -> {type: ['input_key']} -> ToZipObj  -> Req -> MongoObj {$set} | {$addToSet} | {$set, $addToSet}
//base function . Does a distribution of the processes depending on the to_zip_obj variable which may be either an empty or a full object
const _processAttachmentsAndBody = (processes, to_zip_obj, attachments_by_type, req) => {
    // console.log('attachments_by_type', attachments_by_type);
    // console.log('req', req);
	let all_attachments_keys = R.compose(R.flatten, R.values)(attachments_by_type)
	let attachmentsObj = R.pick(all_attachments_keys, req.body)
	let processedAttachments = _processAttachments(processes, attachments_by_type, attachmentsObj)
	let bodyObj = R.omit(all_attachments_keys, req.body)
	let body = Object.keys(bodyObj).length > 0 ? bodyObj  : {}
	let attachments
	let zipped_and_non_zipped
	
	if (to_zip_obj === {}) {
		attachments = Object.keys(attachmentsObj).length > 0 ? addToSetObjFromArr(processedAttachments) : {}
	} else if(typeof to_zip_obj === 'object') {
		zipped_and_non_zipped = _zipAttachments(to_zip_obj, processedAttachments)
		attachments = Object.keys(attachmentsObj).length > 0 ? zipped_and_non_zipped : {}
	}
	return {$set: R.merge(attachments, body)}
}

// PorcessesObj -> {type: ['input_key']} -> Req -> MongoObj {$set} | {$addToSet} | {$set, $addToSet}
const processAttachmentsAndBody = R.curry((processes, attachments_by_type, req) => {
 	return _processAttachmentsAndBody(processes, {}, attachments_by_type, req)
})

// PorcessesObj -> {type: ['input_key']} -> ToZipObj  -> Req -> MongoObj {$set} | {$addToSet} | {$set, $addToSet}
const processZippedAttachmentsAndBody = R.curry((processes, attachments_by_type, to_zip_obj, req) => {
 	return _processAttachmentsAndBody(processes, to_zip_obj, attachments_by_type, req)
})



module.exports = {
	processAttachmentsAndBody,
	processZippedAttachmentsAndBody,
	zipManyWith, 
	processor,
	makeTextProcess,
	mtp//alias de makeTextProcess
}
