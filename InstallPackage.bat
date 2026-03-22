
@echo pnputil -a "%~dp0Realtek\ExtRtk_9152.1\HDX_AsusExt_XPERI4_DSP_RTK_Gen3p1.inf"
pnputil -a "%~dp0Realtek\ExtRtk_9152.1\HDX_AsusExt_XPERI4_DSP_RTK_Gen3p1.inf"

@echo pnputil -a "%~dp0Realtek\Codec_9152.1\HDXACPASUS.inf" /install
pnputil -a "%~dp0Realtek\Codec_9152.1\HDXACPASUS.inf" /install

@echo pnputil -a "%~dp0Realtek\RealtekAPO2_896\RealtekAPO2.inf" /install
pnputil -a "%~dp0Realtek\RealtekAPO2_896\RealtekAPO2.inf" /install

@echo pnputil -a "%~dp0Realtek\RealtekASIO_8\RealtekASIO.inf" /install
pnputil -a "%~dp0Realtek\RealtekASIO_8
\RealtekASIO.inf" /install

@echo pnputil -a "%~dp0Realtek\RealtekHSA_249\RealtekHSA.inf" /install
pnputil -a "%~dp0Realtek\RealtekHSA_249\RealtekHSA.inf" /install

@echo pnputil -a "%~dp0Realtek\RealtekService_366\RealtekService.inf" /install
pnputil -a "%~dp0Realtek\RealtekService_366\RealtekService.inf" /install

@echo Done
