//路由公用
var express=require("express");
var router=express.Router();
var path=require("path");
var stateCode = require(path.join(__dirname, "../../stateCode"));
var until=require(path.join(__dirname, "../../until/until"));
var debug=require("debug")("file");
var fileUpload=require(path.join(__dirname,'../../until/fileUpload'));

//自定义
var fileModel=require(path.join(__dirname,"../../models/admin/fileModel"));

var fs=require("fs");



router.post("/upload",function(req,res,next){
	let fm=new fileModel;

	debug("文件上传");
	if(req.session.role!=='admin'){
		res.json(stateCode.notAuthority());
		return;
	};
	//保存图片到本地磁盘缓存
	fileUpload(req,path.join(__dirname, '../../public/uploadTemp'),function(fileResult){

		if(fileResult.state!==200){
			res.json(fileResult);
			return;
		}

		let {files,fields}=fileResult;
		let fileArry=[];

		Object.keys(files).forEach(function(key){
			let nowFile=files[key];
			let urlIndex=nowFile.path.indexOf("public")+6;

			let tempFile={
				name:nowFile.originalFilename,
				type:nowFile.type,
				width:nowFile.width,
				height:nowFile.height,
				//格式化url，变为相对url
				url:nowFile.path.split("").slice(urlIndex).join("").replace("Temp",""),
				size:nowFile.size,
				created:until.getNowTimeSecondInt()
			};
			fileArry.push(tempFile);
		});
		if(fileArry.length===0){
			res.json(stateCode.fileUploadFail({more:'没有图片上传'}));
			return;
		}

		fm.uploadFile(fileArry,function(result){
			if(result.state!=200){
				res.json(result);
			}else{
				//将图片从临时文件夹移动到正式文件夹
				Object.keys(files).forEach(function(key){
					let path=files[key].path;
					let newPath=path.replace("uploadTemp","upload");
					fs.rename(path,newPath,function(err,res){
						if(err)
							debug(err);
					});
				});

				res.json(stateCode.success({opRes:fileArry}));
			}
		});
	});
});

router.post("/delete",function(req,res,next){
	let fm=new fileModel;
	if(req.session.role!=='admin'){
		res.json(stateCode.notAuthority());
		return;
	};

	let fidArry = until.jsonParse(req.body.fids);

	if (!fidArry) {
		res.json(stateCode.jsonParseFail());
		return;
	}

	let allRes=[];
	let resState=false;

	for(let i=0;i<fidArry.length;i++){
		let fileObj={fid:fidArry[i]};
		fm.getFile(fileObj,function(result){
			if(result.state!==200){
				res.json(stateCode.sqlFail());
				return ;
			}

			if(result.opRes.length<=0){
				res.json(stateCode.sqlNotFound());
				return;
			}
			//删除磁盘文件
			fs.unlink(path.join(__dirname,"../../public/",result.opRes[0].url), function(err){
				// body
				if(err)
					debug(err);
			});

			fm.deleteFile(fileObj,function(result){
				delete result.opRes;
				allRes.push(result);
				if(result.state===200){
					resState=true;
				}

				if(allRes.length===fidArry.length){
					if(resState){
						return res.json(stateCode.success({
							opRes:allRes
						}));						
					}else{
						return res.json(stateCode.fail({
							opRes:allRes
						}));							
					}
				}
			});
		});			
	}
});

router.post("/getList",function(req,res,next){
	let fm=new fileModel;
	fm.getFileList({page:req.body.page,size:req.body.size},function(result){
		if(result.state===200){
			res.json(result);
		}else{
			res.json(stateCode.fail());
		}
	});
});
module.exports=exports=router;