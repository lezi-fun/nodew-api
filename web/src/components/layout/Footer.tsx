import { Typography } from '@douyinfe/semi-ui';
import { useTranslation } from 'react-i18next';

export default function FooterBar() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer className="footer-bar">
      <div className="footer-bar-inner">
        <Typography.Text>{`© ${year} NodEW-api. ${t('版权所有')}`}</Typography.Text>
        <span>
          {t('Apache 2.0 版权声明')}
        </span>
      </div>
    </footer>
  );
}
